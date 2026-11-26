// Makes a seamless, silent H.264 loop for the hero shape.
//
//   swift scripts/make-seamless-loop.swift <input> <output.mp4> [crossfadeSeconds=0.75] [size=1080] [bitrate=3500000]
//
//   size > 0 → centre-crop to a size×size square (cube faces)
//   size = 0 → keep the source frame and aspect (the shader cover-crops per face)
//
// How the seam is removed: with clip length D and crossfade f, the output is
// D − f long. It plays src(f … D−f), then dissolves the tail src(D−f … D) into
// the head src(0 … f). The last blended frame is src(f − 1), the frame just
// before output frame 0, so `loop` wraps with an ordinary one-frame step.
// Native frame rate is kept; change speed at runtime with `playbackRate`.
// Audio is dropped (the hero is always muted). macOS only (AVFoundation +
// Core Image); no ffmpeg required.

import AVFoundation
import CoreImage
import Foundation

let args = CommandLine.arguments
guard args.count >= 3 else {
  FileHandle.standardError.write("usage: make-seamless-loop.swift <input> <output.mp4> [crossfade=0.75] [size=1080|0] [bitrate=3500000]\n".data(using: .utf8)!)
  exit(2)
}
let inputURL = URL(fileURLWithPath: args[1])
let outputURL = URL(fileURLWithPath: args[2])
let crossfade = args.count > 3 ? Double(args[3])! : 0.75
let squareSize = args.count > 4 ? Int(args[4])! : 1080
let bitrate = args.count > 5 ? Int(args[5])! : 3_500_000

func fail(_ msg: String) -> Never {
  FileHandle.standardError.write("error: \(msg)\n".data(using: .utf8)!)
  exit(1)
}

guard FileManager.default.fileExists(atPath: inputURL.path) else { fail("input not found: \(inputURL.path)") }

let ci = CIContext(options: [.workingColorSpace: NSNull(), .outputColorSpace: NSNull()])

func makeBuffer(_ w: Int, _ h: Int) -> CVPixelBuffer {
  var pb: CVPixelBuffer?
  let attrs: [String: Any] = [kCVPixelBufferIOSurfacePropertiesKey as String: [:]]
  CVPixelBufferCreate(nil, w, h, kCVPixelFormatType_32BGRA, attrs as CFDictionary, &pb)
  return pb!
}

/// Square mode: centre-crop and scale. Native mode: pass through.
func prepare(_ buffer: CVPixelBuffer) -> CIImage {
  let img = CIImage(cvPixelBuffer: buffer)
  guard squareSize > 0 else { return img }
  let w = img.extent.width, h = img.extent.height
  let side = min(w, h)
  let cropped = img.cropped(to: CGRect(x: (w - side) / 2, y: (h - side) / 2, width: side, height: side))
    .transformed(by: CGAffineTransform(translationX: -(w - side) / 2, y: -(h - side) / 2))
  let s = CGFloat(squareSize) / side
  return cropped.transformed(by: CGAffineTransform(scaleX: s, y: s))
}

let sem = DispatchSemaphore(value: 0)
Task {
  defer { sem.signal() }
  do {
    let asset = AVURLAsset(url: inputURL)
    guard let track = try await asset.loadTracks(withMediaType: .video).first else { fail("no video track") }
    let fps = Double(try await track.load(.nominalFrameRate))
    let natural = try await track.load(.naturalSize)
    let duration = try await asset.load(.duration).seconds
    let total = Int((duration * fps).rounded(.down))
    let fadeFrames = Int((crossfade * fps).rounded())
    guard fadeFrames > 0, fadeFrames * 2 < total else { fail("crossfade too long for a \(duration)s clip") }
    let frameTime = CMTime(value: 1001, timescale: CMTimeScale((fps * 1001).rounded()))

    // H.264 wants even dimensions.
    let outW = squareSize > 0 ? squareSize : Int(natural.width) & ~1
    let outH = squareSize > 0 ? squareSize : Int(natural.height) & ~1

    // Reader
    let reader = try AVAssetReader(asset: asset)
    let readerOut = AVAssetReaderTrackOutput(track: track, outputSettings: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    ])
    readerOut.alwaysCopiesSampleData = false
    reader.add(readerOut)

    // Writer
    try? FileManager.default.removeItem(at: outputURL)
    let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
    writer.shouldOptimizeForNetworkUse = true // moov first: starts playing before fully downloaded
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: outW,
      AVVideoHeightKey: outH,
      AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
      ],
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: bitrate,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoExpectedSourceFrameRateKey: Int(fps.rounded()),
        AVVideoMaxKeyFrameIntervalKey: Int(fps.rounded()),
      ],
    ])
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey as String: outW,
      kCVPixelBufferHeightKey as String: outH,
    ])
    writer.add(input)

    guard reader.startReading() else { fail("reader: \(reader.error?.localizedDescription ?? "?")") }
    guard writer.startWriting() else { fail("writer: \(writer.error?.localizedDescription ?? "?")") }
    writer.startSession(atSourceTime: .zero)

    let bounds = CGRect(x: 0, y: 0, width: outW, height: outH)
    var written = 0
    func write(_ image: CIImage) {
      while !input.isReadyForMoreMediaData { usleep(2000) }
      var pb: CVPixelBuffer?
      CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
      guard let out = pb else { fail("no pixel buffer from pool") }
      ci.render(image.cropped(to: bounds), to: out)
      let pts = CMTimeMultiply(frameTime, multiplier: Int32(written))
      if !adaptor.append(out, withPresentationTime: pts) { fail("append: \(writer.error?.localizedDescription ?? "?")") }
      written += 1
    }

    var head: [CVPixelBuffer] = [] // first `fadeFrames` frames, owned copies
    var index = 0
    let tailStart = total - fadeFrames

    while index < total, let sample = readerOut.copyNextSampleBuffer() {
      guard let src = CMSampleBufferGetImageBuffer(sample) else { continue }
      let frame = prepare(src)
      if index < fadeFrames {
        let copy = makeBuffer(outW, outH) // reader buffers are recycled; keep our own
        ci.render(frame.cropped(to: bounds), to: copy)
        head.append(copy)
      } else if index < tailStart {
        write(frame)
      } else {
        // Dissolve tail → head. Reaches exactly 1 on the last frame: it equals
        // src(f − 1), the frame just before output frame 0.
        let k = index - tailStart
        let t = Double(k + 1) / Double(fadeFrames)
        let target = CIImage(cvPixelBuffer: head[k])
        let blended = CIFilter(name: "CIDissolveTransition", parameters: [
          kCIInputImageKey: frame, kCIInputTargetImageKey: target, kCIInputTimeKey: t,
        ])!.outputImage!
        write(blended)
      }
      index += 1
    }
    reader.cancelReading()

    input.markAsFinished()
    await writer.finishWriting()
    guard writer.status == .completed else { fail("finish: \(writer.error?.localizedDescription ?? "?")") }
    let bytes = (try FileManager.default.attributesOfItem(atPath: outputURL.path)[.size] as? Int) ?? 0
    print(String(format: "wrote %@ — %d frames, %.2fs @ %.2ffps, %dx%d, %.0f KB (crossfade %.2fs)",
                 outputURL.lastPathComponent, written, Double(written) / fps, fps, outW, outH,
                 Double(bytes) / 1024, Double(fadeFrames) / fps))
  } catch {
    fail(error.localizedDescription)
  }
}
sem.wait()
