// Real decoded frames in the shared browser, with original LOCAL media only.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { promisify } from "node:util";
const repo = process.cwd(),
  dir = mkdtempSync(join(tmpdir(), "zetahub-player-"));
const run = promisify(execFile);
const browser = async (...args) =>
  (
    await run("coderabbit-agent-browser", args, {
      encoding: "utf8",
      timeout: 30000,
    })
  ).stdout;
const evaluate = async (code) => JSON.parse(await browser("eval", code));
const wait = async (test, label) => {
  const end = Date.now() + 25000;
  while (Date.now() < end) {
    if (await test()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.error(await browser("eval", "document.body.innerText.slice(0,3000)"));
  console.error(await browser("errors"));

  console.error(
    await browser(
      "eval",
      '(()=>{const v=document.querySelector("video");return v?{src:v.currentSrc,ready:v.readyState,error:v.error?.message,can:v.canPlayType(\'video/mp4; codecs="avc1.42E01E"\')}:null})()',
    ),
  );
  throw new Error(`Timed out: ${label}`);
};
let server;
try {
  mkdirSync(join(dir, "hls"));
  mkdirSync(join(dir, "dash"));
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      join(repo, "public/media/zeta-orbit.webm"),
      "-t",
      "10",
      "-c:v",
      "copy",
      "-tag:v",
      "vp09",
      "-an",
      "-movflags",
      "+faststart",
      join(dir, "fixture.mp4"),
    ],
    { stdio: "pipe" },
  );
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      join(dir, "fixture.mp4"),
      "-c",
      "copy",
      "-hls_segment_type",
      "fmp4",
      "-hls_time",
      "2",
      "-hls_playlist_type",
      "vod",
      join(dir, "hls/index.m3u8"),
    ],
    { stdio: "pipe" },
  );
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      join(dir, "fixture.mp4"),
      "-c",
      "copy",
      "-f",
      "dash",
      "-dash_segment_type",
      "mp4",
      "-seg_duration",
      "2",
      join(dir, "dash/index.mpd"),
    ],
    { stdio: "pipe" },
  );
  writeFileSync(
    join(dir, "id.vtt"),
    "WEBVTT\n\n00:00:00.000 --> 00:00:09.000\nVideo uji lokal ZetaHub.\n",
  );
  const requests = {};
  server = await createServer({
    configFile: false,
    root: join(repo, "tests/browser"),
    publicDir: dir,
    resolve: { alias: { "@": join(repo, "src") } },
    oxc: { jsx: { runtime: "automatic" } },
    server: {
      host: "0.0.0.0",
      port: 4174,
      strictPort: true,
      fs: { allow: [repo, dir] },
    },
    plugins: [
      {
        name: "count-fixture-requests",
        configureServer(s) {
          s.middlewares.use((req, res, next) => {
            if (req.url?.startsWith("/missing.mp4")) {
              requests.missing = (requests.missing || 0) + 1;
              res.statusCode = 404;
              res.end("missing synthetic media");
              return;
            }
            next();
          });
        },
      },
    ],
  });
  await server.listen();
  for (const mode of ["mp4", "hls", "dash", "failover", "subtitles"]) {
    requests.missing = 0;
    await browser("open", `http://localhost:4174/?mode=${mode}`);
    await wait(
      () => evaluate('Boolean(document.querySelector("video")?.readyState>=2)'),
      "loaded " + mode,
    );
    await evaluate(
      '(async()=>{const v=document.querySelector("video");v.muted=true;await v.play();return true})()',
    );
    await wait(
      () =>
        evaluate(
          'Boolean(document.querySelector("video")?.currentTime>0.5 && document.querySelector("video")?.videoWidth>0)',
        ),
      "decoded frames " + mode,
    );
    const media = await evaluate(
      '(()=>{const v=document.querySelector("video");return {width:v.videoWidth,time:v.currentTime,frames:v.getVideoPlaybackQuality().totalVideoFrames}})()',
    );
    assert.ok(media.frames > 0);
    if (mode === "failover")
      assert.equal(requests.missing, 3, "initial attempt + two retries");
    if (mode === "subtitles") {
      await browser("select", 'select[aria-label="Subtitle provider"]', "0");
      await wait(
        () =>
          evaluate(
            'document.querySelector("video").textTracks[0].cues?.length>0',
          ),
        "subtitle cues",
      );
    }
    console.log(
      `PASS ${mode}: actual decoded frames; width=${media.width}, frames=${media.frames}`,
    );
  }
  for (const mode of [
    "empty",
    "inconsistent",
    "expired",
    "official",
    "fallback",
    "exhausted",
  ]) {
    requests.missing = 0;
    await browser("open", `http://localhost:4174/?mode=${mode}`);
    await wait(
      () =>
        evaluate(
          'document.body.textContent.includes("Playback unavailable") || document.body.textContent.includes("Watch officially")',
        ),
      "fallback " + mode,
    );
    assert.equal(
      await evaluate('document.querySelectorAll("video,iframe").length'),
      0,
    );
    if (["fallback", "exhausted"].includes(mode))
      assert.equal(requests.missing, 3);
    console.log(`PASS ${mode}: no empty player`);
  }
} finally {
  if (server) await server.close();
  rmSync(dir, { recursive: true, force: true });
  await browser("open", "http://localhost:3000/search");
}
