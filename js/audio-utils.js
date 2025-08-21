/**
 * 音频工具：将包含 Opus 的音频（webm/ogg/mp4）转换为 16kHz 单声道 WAV(PCM16)
 * 仅用于原型阶段，追求“可用优先”。
 */

async function decodeToPCM(audioBlob) {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

  const numChannels = 1; // 单声道
  const sampleRate = 16000; // 16kHz
  const duration = audioBuffer.duration;
  const totalSamples = Math.floor(duration * sampleRate);

  // 下混为单声道并重采样到 16kHz
  const offline = new OfflineAudioContext(numChannels, totalSamples, sampleRate);
  const src = offline.createBufferSource();

  // 将多声道平均为单声道
  const monoBuffer = offline.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
  const tmp = new Float32Array(audioBuffer.length);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    audioBuffer.copyFromChannel(tmp, ch);
    const mono = monoBuffer.getChannelData(0);
    for (let i = 0; i < tmp.length; i++) mono[i] += tmp[i] / audioBuffer.numberOfChannels;
  }

  src.buffer = monoBuffer;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

function pcmToWav(pcmFloat32, sampleRate = 16000) {
  // 转 PCM16
  const pcm16 = new Int16Array(pcmFloat32.length);
  for (let i = 0; i < pcmFloat32.length; i++) {
    let s = Math.max(-1, Math.min(1, pcmFloat32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const bytesPerSample = 2;
  const blockAlign = bytesPerSample * 1; // 单声道
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm16.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  let offset = 0;
  writeString(offset, 'RIFF'); offset += 4;
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString(offset, 'WAVE'); offset += 4;
  writeString(offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // PCM 子块大小
  view.setUint16(offset, 1, true); offset += 2;  // PCM 格式
  view.setUint16(offset, 1, true); offset += 2;  // 通道数 1
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2; // 位深 16
  writeString(offset, 'data'); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;

  // 写入数据
  offset = 44;
  for (let i = 0; i < pcm16.length; i++) view.setInt16(offset + i * 2, pcm16[i], true);

  return new Blob([view], { type: 'audio/wav' });
}

async function convertToWavIfNeeded(audioBlob) {
  // 若编码包含 opus，强制转 wav
  const t = (audioBlob.type || '').toLowerCase();
  if (t.includes('opus')) {
    console.log('🎛️ 检测到 Opus，开始转 WAV(16kHz 单声道) ...');
    try {
      const pcm = await decodeToPCM(audioBlob);
      const wavBlob = pcmToWav(pcm, 16000);
      console.log('✅ 转 WAV 成功，大小:', wavBlob.size);
      return wavBlob;
    } catch (e) {
      console.warn('⚠️ 转 WAV 失败，回退使用原始音频:', e);
      return audioBlob;
    }
  }
  return audioBlob;
}

window.AudioUtils = { convertToWavIfNeeded };

