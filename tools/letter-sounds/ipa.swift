import AVFoundation
import Foundation
// Speaks IPA strings with an Apple voice and writes each one to <outdir>/<name>.caf.
// usage: ipatool <voice name or id> <outdir> name=ipa ...   (driven by build.py)
let args = CommandLine.arguments
let voiceQuery = args[1], outDir = args[2]
let voices = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("en-US") }
let voice = voices.first { $0.name == voiceQuery || $0.identifier == voiceQuery } ?? AVSpeechSynthesisVoice(language: "en-US")!
FileHandle.standardError.write("voice: \(voice.name) \(voice.identifier)\n".data(using: .utf8)!)
let synth = AVSpeechSynthesizer()
for pair in args.dropFirst(3) {
  let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
  let name = parts[0], ipa = parts[1]
  let text = NSMutableAttributedString(string: "x")
  text.addAttribute(NSAttributedString.Key(AVSpeechSynthesisIPANotationAttribute), value: ipa, range: NSRange(location: 0, length: text.length))
  let utt = AVSpeechUtterance(attributedString: text)
  utt.voice = voice
  utt.rate = 0.4
  var file: AVAudioFile? = nil
  let sem = DispatchSemaphore(value: 0)
  var done = false
  synth.write(utt) { buf in
    guard let pcm = buf as? AVAudioPCMBuffer else { return }
    if pcm.frameLength == 0 { if !done { done = true; sem.signal() }; return }
    if file == nil {
      file = try? AVAudioFile(forWriting: URL(fileURLWithPath: "\(outDir)/\(name).caf"), settings: pcm.format.settings, commonFormat: pcm.format.commonFormat, interleaved: pcm.format.isInterleaved)
    }
    try? file?.write(from: pcm)
  }
  // pump runloop until done
  let deadline = Date().addingTimeInterval(10)
  while !done && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.05)) }
  file = nil
  print(name, done ? "ok" : "timeout")
}
