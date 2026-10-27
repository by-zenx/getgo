import gsap from "gsap";

export function moveSegmentPill(
  pill: HTMLElement,
  activeButton: HTMLElement,
  immediate = false
) {
  const target = { x: activeButton.offsetLeft - 3, width: activeButton.offsetWidth };
  if (immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.set(pill, target);
    return;
  }

  gsap.to(pill, {
    ...target,
    duration: 0.64,
    ease: "power3.inOut",
    overwrite: "auto",
  });
}
