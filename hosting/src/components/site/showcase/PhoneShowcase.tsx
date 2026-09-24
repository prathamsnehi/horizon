import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { color, font, layout } from "@/lib/tokens";

/**
 * Desktop scroll-scrubbed showcase. The section is pinned; scroll position drives the
 * active clip's playback frame-by-frame (stop scrolling → the frame freezes). Each
 * clip owns a slice of the scroll; crossing into the next flips the row direction
 * so the phone slides to the other side and the text swaps with it (a zigzag,
 * animated via `layout`). Clips live in public/showcase as <base>.mp4 + <base>.jpg
 * poster. Under reduced motion the clips aren't scrubbed — the poster shows per
 * step and the swap snaps.
 */
const SCREENS = [
  {
    base: "/showcase/app-01-name",
    label: "Pick your fears",
    caption: "Swipe a deck of hesitations. Tap the ones that are yours.",
  },
  {
    base: "/showcase/app-02-quest",
    label: "Get tailored quests",
    caption:
      "A handful, curated for you. Or describe your own and it builds it.",
  },
  {
    base: "/showcase/app-03-map",
    label: "On the map",
    caption:
      "Usually twenty minutes or so away. Never further than you asked for.",
  },
  {
    base: "/showcase/app-04-log",
    label: "Into the log",
    caption: "Post how it went. It stays yours, and nothing is keeping score.",
  },
];
const N = SCREENS.length;
const STEP_VH = 320; // scroll length per clip — long, so normal-speed scrolling still scrubs smoothly
const SCREEN_W = 300;
const SCREEN_H = 650;
/** Height of the fixed StickyHeader. The pinned area is padded down by this, so
 *  the content centres in the band between the nav's bottom edge and the bottom
 *  of the screen — not in the full viewport, where the nav overlay would always
 *  make it read high. */
const NAV_SAFE = 66;
/** Breathing room kept above and below the phone inside that band. */
const BREATH = 24;
/** Gap between the phone and the caption in the stacked (narrow) layout. */
const STACK_GAP = 28;

export function PhoneShowcase() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 859px)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 859px)");
    const onChange = () => setMobile(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return mobile ? <MobilePhoneShowcase /> : <DesktopPhoneShowcase />;
}

/** All four steps stay in normal document flow on narrow screens. */
function MobilePhoneShowcase() {
  const reduce = useReducedMotion() ?? false;

  return (
    <ol
      role="list"
      style={{
        listStyle: "none",
        margin: 0,
        padding: "80px 20px 96px",
        display: "grid",
        gap: 88,
        justifyItems: "center",
      }}
    >
      {SCREENS.map((screen, index) => (
        <li
          key={screen.base}
          style={{
            width: "100%",
            maxWidth: 440,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: font.display,
              fontSize: 12.5,
              fontWeight: 800,
              letterSpacing: ".2em",
              textTransform: "lowercase",
              color: color.rust,
              marginBottom: 14,
            }}
          >
            {`SEE IT WORK · 0${index + 1}`}
          </div>
          <h2
            style={{
              margin: "0 0 16px",
              fontFamily: font.display,
              fontSize: "clamp(30px, 4vw, 50px)",
              fontWeight: 800,
              letterSpacing: "-.04em",
              lineHeight: 1,
              textTransform: "lowercase",
              color: color.ink,
            }}
          >
            {screen.label}.
          </h2>
          <p
            style={{
              margin: "0 0 28px",
              fontSize: "clamp(15px, 1.6vw, 18px)",
              lineHeight: 1.6,
              color: color.inkBody,
            }}
          >
            {screen.caption}
          </p>
          <MobilePhoneMedia screen={screen} reduce={reduce} eager={index === 0} />
        </li>
      ))}
    </ol>
  );
}

/** Start each clip at normal speed when its phone enters view; pause it off screen. */
function MobilePhoneMedia({
  screen,
  reduce,
  eager,
}: {
  screen: (typeof SCREENS)[number];
  reduce: boolean;
  eager: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || reduce) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setHasEntered(true);
      },
      { threshold: 0.2 },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [reduce]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (visible) {
      void video.play().catch(() => setPlayBlocked(true));
    } else {
      video.pause();
    }
  }, [visible, hasEntered, reduce, failed]);

  // Keep the same poster element over the video until a decoded frame reaches
  // the compositor. The video poster alone can disappear before that on mobile.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || firstFrameReady || !video.requestVideoFrameCallback) return;
    const handle = video.requestVideoFrameCallback(() => setFirstFrameReady(true));
    return () => video.cancelVideoFrameCallback(handle);
  }, [hasEntered, reduce, failed, firstFrameReady]);

  const showPoster = reduce || !hasEntered || failed;
  return (
    <div
      ref={frameRef}
      style={{
        position: "relative",
        width: "min(72vw, 280px)",
        aspectRatio: `${SCREEN_W + 24} / ${SCREEN_H + 24}`,
        padding: 10,
        boxSizing: "border-box",
        borderRadius: 42,
        background: "linear-gradient(145deg, #2a2622, #0b0907)",
        boxShadow: "0 28px 48px -24px rgba(38,34,27,.5)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 32,
          overflow: "hidden",
          background: color.paper,
        }}
      >
        {!showPoster && (
          <video
            ref={videoRef}
            src={`${screen.base}.mp4`}
            poster={`${screen.base}.jpg`}
            muted
            playsInline
            autoPlay
            loop
            preload="auto"
            controls={false}
            aria-label={`${screen.label} app demonstration`}
            onCanPlay={() => {
              if (visible) void videoRef.current?.play().catch(() => setPlayBlocked(true));
            }}
            onLoadedData={() => {
              if (videoRef.current && !videoRef.current.requestVideoFrameCallback) {
                setFirstFrameReady(true);
              }
            }}
            onPlaying={() => setPlayBlocked(false)}
            onError={() => setFailed(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
        {(showPoster || !firstFrameReady) && (
          <img
            src={`${screen.base}.jpg`}
            alt={`${screen.label} screen in Horizon`}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
            }}
          />
        )}
        {playBlocked && !showPoster && (
          <button
            type="button"
            onClick={() => void videoRef.current?.play().catch(() => setPlayBlocked(true))}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 18,
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              border: 0,
              borderRadius: 8,
              padding: "10px 14px",
              background: color.ink,
              color: color.white,
              fontFamily: font.display,
              fontWeight: 700,
            }}
          >
            Play demo
          </button>
        )}
      </div>
    </div>
  );
}

function DesktopPhoneShowcase() {
  const reduce = useReducedMotion() ?? false;
  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1200,
    h: typeof window !== "undefined" ? window.innerHeight : 900,
  }));
  const [clipIndex, setClipIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  // Scrubbing only paints if the bytes for that timestamp are already buffered.
  // On a cold load the scroll outruns the download, so until a clip is buffered
  // we keep its poster over the top and skip seeking entirely — a still frame
  // reads as intentional, a blank phone screen reads as broken.
  const [ready, setReady] = useState(false);

  const narrow = vp.w < 860;
  const gutter = Math.min(48, Math.max(20, vp.w * 0.05));

  const sectionRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  // Real rendered height of the caption block, so the stacked layout sizes the
  // phone against what the text actually occupies instead of a guessed constant.
  const [textH, setTextH] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef(0);
  const idxRef = useRef(0);
  // iOS Safari will not paint a frame from a currentTime seek on a video that
  // has never played: the poster is dropped on seek and nothing is decoded
  // behind it, so the phone screen goes blank. Playing and immediately pausing
  // forces a decode. Allowed without a gesture because the video is muted +
  // playsInline — except in Low Power Mode, which is what the touch fallback is
  // for. Desktop decodes on seek regardless, so this is a no-op there.
  const primedRef = useRef(false);
  const readyRef = useRef(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const applyScrub = (p: number) => {
    const total = Math.min(N - 0.0001, Math.max(0, p * N));
    const idx = Math.floor(total);
    const local = total - idx;
    if (idx !== idxRef.current) {
      idxRef.current = idx;
      setClipIndex(idx);
      setFailed(false);
      // The next <video> mounts fresh, so the old clip's duration must not be
      // used to seek it — clips run 5.9s to 23.3s, and mixing them up lands the
      // playhead in the wrong place until onLoadedMetadata arrives. Zero here
      // means "don't seek yet"; onMeta sets the real value and re-applies.
      durationRef.current = 0;
      // Nothing of the new clip is buffered yet: hold its poster and don't seek
      // until it is. Without resetting these, clips 2-4 would inherit clip 1's
      // "ready" and go blank on a cold load.
      readyRef.current = false;
      setReady(false);
    }
    const v = videoRef.current;
    if (v && readyRef.current && durationRef.current > 0) {
      const t = Math.min(
        durationRef.current - 0.05,
        local * durationRef.current,
      );
      if (Math.abs(v.currentTime - t) > 0.01) v.currentTime = t;
    }
  };
  useMotionValueEvent(scrollYProgress, "change", applyScrub);

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTextH(e.contentRect.height));
    ro.observe(el);
    setTextH(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [narrow]);

  const prime = () => {
    const v = videoRef.current;
    if (!v) return;
    const played = v.play();
    if (played && typeof played.then === "function") {
      played
        .then(() => {
          v.pause();
          primedRef.current = true;
          applyScrub(scrollYProgress.get());
        })
        .catch(() => {
          // Blocked (Low Power Mode / no gesture yet) — the touch handler retries.
        });
    } else {
      v.pause();
      primedRef.current = true;
    }
  };

  // Retry priming on the visitor's first touch, which on a phone is the same
  // gesture that starts the scroll, so the clip is decoded before it matters.
  useEffect(() => {
    const onFirstTouch = () => {
      if (!primedRef.current) prime();
    };
    window.addEventListener("touchstart", onFirstTouch, { passive: true });
    window.addEventListener("pointerdown", onFirstTouch, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onFirstTouch);
      window.removeEventListener("pointerdown", onFirstTouch);
    };
  }, []);

  /** Enough of the clip is buffered to scrub it without thrashing on range requests. */
  const markReady = () => {
    if (readyRef.current) return;
    readyRef.current = true;
    setReady(true);
    applyScrub(scrollYProgress.get());
  };

  // canplaythrough is the primary signal; buffered coverage is the fallback for
  // browsers that never fire it (notably iOS Safari with preload restricted).
  const onProgress = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const end = v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0;
    if (end / v.duration > 0.9) markReady();
  };

  const onMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    durationRef.current = v.duration || 0;
    // Each clip mounts a fresh <video> (keyed by base), so every one needs priming.
    primedRef.current = false;
    prime();
    applyScrub(scrollYProgress.get());
  };

  // Vertical room the phone may occupy inside the below-the-nav band: the nav
  // strip comes off the top, BREATH off each end, and the stacked layout also
  // gives up the measured caption height plus its gap.
  const roomH = vp.h - NAV_SAFE - BREATH * 2 - (narrow ? textH + STACK_GAP : 0);
  // No lower clamp: the phone must always fit the viewport it is centred in — a
  // floor here is what previously pushed it up under the nav on short screens.
  const scale = Math.min(
    narrow ? (vp.w - 40) / (SCREEN_W + 24) : (vp.w * 0.42) / (SCREEN_W + 24),
    Math.max(0, roomH) / (SCREEN_H + 24),
    1,
  );

  const s = SCREENS[clipIndex];
  const next = SCREENS[clipIndex + 1];
  const phoneLeft = clipIndex % 2 === 0;
  const swap = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 120, damping: 20, mass: 0.9 };

  const z = scale; // scale every dimension so the layout box == the visual box (centers reliably)
  const bezelW = (SCREEN_W + 24) * z;
  const bezelH = (SCREEN_H + 24) * z;
  const phone = (
    <div style={{ position: "relative", width: bezelW, height: bezelH }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: bezelW * 1.15,
          height: bezelH * 0.55,
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,182,147,.4), rgba(255,182,147,0) 68%)",
          filter: "blur(30px)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: bezelW,
          height: bezelH,
          borderRadius: 54 * z,
          background: "linear-gradient(145deg, #2a2622, #0b0907)",
          padding: 12 * z,
          boxSizing: "border-box",
          boxShadow: `0 ${60 * z}px ${100 * z}px ${-44 * z}px rgba(38,34,27,.6), inset 0 0 0 1.5px rgba(247,241,234,.1)`,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: -3 * z,
            top: 150 * z,
            width: 3 * z,
            height: 58 * z,
            borderRadius: 3 * z,
            background: "#1a1613",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -3 * z,
            top: 132 * z,
            width: 3 * z,
            height: 78 * z,
            borderRadius: 3 * z,
            background: "#1a1613",
          }}
        />
        <div
          style={{
            position: "relative",
            width: SCREEN_W * z,
            height: SCREEN_H * z,
            borderRadius: 42 * z,
            overflow: "hidden",
            background: "#000",
          }}
        >
          {failed ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                background: color.paper,
                padding: 24,
                textAlign: "center",
              }}
            >
              <span
                style={{
                  width: 48,
                  height: 24,
                  background: color.peach,
                  borderRadius: "48px 48px 0 0",
                }}
              />
              <div
                style={{
                  fontFamily: font.display,
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: "-.02em",
                  color: color.ink,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 12, color: color.inkFaint }}>
                clip goes here
              </div>
            </div>
          ) : reduce ? (
            <img
              key={s.base}
              src={`${s.base}.jpg`}
              alt={s.label}
              onError={() => setFailed(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <video
              ref={videoRef}
              key={s.base}
              src={`${s.base}.mp4`}
              poster={`${s.base}.jpg`}
              muted
              playsInline
              preload="auto"
              controls={false}
              onLoadedMetadata={onMeta}
              onCanPlayThrough={markReady}
              onProgress={onProgress}
              onError={() => setFailed(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          )}
          {/* Poster held over the clip until it can be scrubbed. */}
          {!failed && !reduce && !ready && (
            <img
              key={`${s.base}-hold`}
              src={`${s.base}.jpg`}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
          {/* Warm the next clip while this one is on screen, so arriving at the
              step doesn't start a cold download. Off-screen and never played. */}
          {!reduce && next && (
            <video
              key={`${next.base}-prefetch`}
              src={`${next.base}.mp4`}
              muted
              playsInline
              preload="auto"
              aria-hidden
              tabIndex={-1}
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );

  const text = (
    <motion.div
      key={clipIndex}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ textAlign: narrow ? "center" : "left" }}
    >
      <div
        style={{
          fontFamily: font.display,
          fontSize: 12.5,
          fontWeight: 800,
          letterSpacing: ".2em",
          textTransform: "lowercase",
          color: color.rust,
          marginBottom: 14,
        }}
      >{`SEE IT WORK · 0${clipIndex + 1}`}</div>
      <h2
        style={{
          margin: "0 0 16px",
          fontFamily: font.display,
          fontSize: "clamp(30px,4vw,50px)",
          fontWeight: 800,
          letterSpacing: "-.04em",
          lineHeight: 1,
          textTransform: "lowercase",
          color: color.ink,
        }}
      >
        {s.label}.
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: "clamp(15px,1.6vw,18px)",
          lineHeight: 1.6,
          color: color.inkBody,
        }}
      >
        {s.caption}
      </p>
    </motion.div>
  );

  return (
    <div
      ref={sectionRef}
      style={{ position: "relative", height: `${N * STEP_VH}vh` }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowX: "clip",
          overflowY: "visible",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `${NAV_SAFE}px ${gutter}px 0`,
          boxSizing: "border-box",
        }}
      >
        {narrow ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: STACK_GAP,
              maxWidth: 440,
            }}
          >
            {phone}
            {/* stable wrapper: `text` remounts per clip, so the observer sits here */}
            <div ref={textRef} style={{ width: "100%" }}>
              {text}
            </div>
          </div>
        ) : (
          <motion.div
            style={{
              display: "flex",
              flexDirection: phoneLeft ? "row" : "row-reverse",
              alignItems: "center",
              justifyContent: "center",
              gap: "clamp(30px,6vw,110px)",
              width: "100%",
              maxWidth: layout.pageMax,
            }}
          >
            <motion.div layout transition={swap} style={{ flexShrink: 0 }}>
              {phone}
            </motion.div>
            <motion.div
              layout
              transition={swap}
              style={{ width: "min(420px, 40%)", flexShrink: 0 }}
            >
              {text}
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
