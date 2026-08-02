#!/usr/bin/env bash
# Builds the recordings the real-audio test plays into Chromium as the mic.
# Real human speech comes from the Open Speech Repository (free to use).
set -e
OUT=${1:-/tmp/audio}
mkdir -p "$OUT" && cd "$OUT"
curl -sSfL -o speech_raw.wav "https://www.voiptroubleshooter.com/open_speech/american/OSR_us_000_0010_8k.wav"
ffmpeg -y -loglevel error -i speech_raw.wav -ar 48000 -ac 1 speech.wav
D=12
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=brown:amplitude=1:duration=$D:sample_rate=48000" -af "lowpass=f=220,volume=6" -ac 1 wind.wav
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=80:duration=$D:sample_rate=48000" -f lavfi -i "sine=frequency=160:duration=$D:sample_rate=48000" -f lavfi -i "anoisesrc=color=brown:amplitude=0.6:duration=$D:sample_rate=48000" -filter_complex "[0][1][2]amix=inputs=3:weights=1 0.6 0.8,lowpass=f=300,volume=3" -ac 1 engine.wav
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=brown:amplitude=1:duration=$D:sample_rate=48000" -af "lowpass=f=350,tremolo=f=0.8:d=0.9,volume=8" -ac 1 fart.wav
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=white:amplitude=0.002:duration=$D:sample_rate=48000" -ac 1 quiet.wav
# Bar babble: six overlapping copies of real speech, the standard way this is simulated.
ffmpeg -y -loglevel error -i speech.wav -i speech.wav -i speech.wav -i speech.wav -i speech.wav -i speech.wav -filter_complex \
"[0]atrim=0:$D,asetpts=N/SR/TB[a];[1]atrim=3:$((D+3)),asetpts=N/SR/TB[b];[2]atrim=7:$((D+7)),asetpts=N/SR/TB[c];[3]atrim=11:$((D+11)),asetpts=N/SR/TB[d];[4]atrim=15:$((D+15)),asetpts=N/SR/TB[e];[5]atrim=19:$((D+19)),asetpts=N/SR/TB[f];[a][b][c][d][e][f]amix=inputs=6:duration=first,volume=2.5" -ac 1 bar.wav
meas(){ ffmpeg -hide_banner -nostats -i "$1" -af volumedetect -f null /dev/null 2>&1 | grep mean_volume | sed 's/.*mean_volume: //;s/ dB//'; }
SV=$(meas speech.wav); WV=$(meas wind.wav)
SG=$(python3 -c "print(-20-($SV))")
ffmpeg -y -loglevel error -i speech.wav -af "volume=${SG}dB,atrim=0:$D" -ac 1 speech_norm.wav
for snr in 12 6 0; do
  WG=$(python3 -c "print(-20-$snr-($WV))")
  ffmpeg -y -loglevel error -i speech.wav -i wind.wav -filter_complex \
   "[0]atrim=0:$D,asetpts=N/SR/TB,volume=${SG}dB[s];[1]volume=${WG}dB[w];[s][w]amix=inputs=2:duration=first:normalize=0" -ac 1 "wind_snr${snr}.wav"
done
echo "audio ready in $OUT"

# Music, and music with someone talking over it. Music lives in the same
# frequencies as speech, so it is the hardest thing to tell a voice apart from.
D=12
ffmpeg -y -loglevel error \
 -f lavfi -i "sine=frequency=98:duration=$D:sample_rate=48000" \
 -f lavfi -i "sine=frequency=196:duration=$D:sample_rate=48000" \
 -f lavfi -i "sine=frequency=294:duration=$D:sample_rate=48000" \
 -f lavfi -i "sine=frequency=392:duration=$D:sample_rate=48000" \
 -f lavfi -i "sine=frequency=587:duration=$D:sample_rate=48000" \
 -f lavfi -i "sine=frequency=784:duration=$D:sample_rate=48000" \
 -f lavfi -i "sine=frequency=1175:duration=$D:sample_rate=48000" \
 -f lavfi -i "anoisesrc=color=white:amplitude=0.5:duration=$D:sample_rate=48000" \
 -filter_complex "[0]volume=0.9[b];[1]volume=0.7[b2];[2]volume=0.6,tremolo=f=2:d=0.7[c1];[3]volume=0.55,tremolo=f=2:d=0.7[c2];[4]volume=0.5,tremolo=f=4:d=0.8[m1];[5]volume=0.4,tremolo=f=4:d=0.8[m2];[6]volume=0.25,tremolo=f=8:d=0.9[m3];[7]highpass=f=6000,volume=0.35,tremolo=f=4:d=0.95[hat];[b][b2][c1][c2][m1][m2][m3][hat]amix=inputs=8:normalize=0,volume=1.6" -ac 1 music.wav
MV=$(meas music.wav)
ffmpeg -y -loglevel error -i music.wav -af "volume=$(python3 -c "print(-20-($MV))")dB" -ac 1 music_norm.wav
for snr in 10 3; do
  MG=$(python3 -c "print(-20-$snr-($MV))")
  ffmpeg -y -loglevel error -i speech.wav -i music.wav -filter_complex \
   "[0]atrim=0:$D,asetpts=N/SR/TB,volume=${SG}dB[s];[1]volume=${MG}dB[m];[s][m]amix=inputs=2:duration=first:normalize=0" -ac 1 "music_speech${snr}.wav"
done
echo "music clips ready"
