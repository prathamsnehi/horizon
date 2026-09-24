import { color } from "@/lib/tokens";
import { PhoneShowcase } from "./showcase/PhoneShowcase";

/**
 * The showcase uses a scroll-driven, pinned walkthrough on desktop and four
 * normally scrolling, auto-playing video steps on narrow screens. Firebase-free;
 * id="steps" keeps the header/nav anchor working.
 */
export default function Showcase() {
  return (
    <section id="steps" style={{ background: color.paper }}>
      <PhoneShowcase />
    </section>
  );
}
