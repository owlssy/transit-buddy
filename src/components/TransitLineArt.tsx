import Svg, { Circle, Path } from "react-native-svg";

/**
 * Flat hand-drawn-style subway-line squiggle, echoing the pitch-deck brand
 * mark. Purely decorative — corner accents on the Home screen hero. Left and
 * right use different line layouts (not a mirrored copy of each other), same
 * as the reference art.
 */
export function TransitLineArt({
  side = "left",
  width = 120,
  height = 90,
}: {
  side?: "left" | "right" | "duo";
  width?: number | string;
  height?: number;
}) {
  if (side === "duo") {
    // Two hand-drawn subway lines (navy + green) running behind the Home
    // header's logo badge, like the badge sits on an interchange station.
    // viewBox height must match the rendered `height` exactly (only the
    // width stretches via preserveAspectRatio="none") so the lines land at
    // a known, stable y — that's what keeps this centered on the badge.
    return (
      <Svg width={width} height={height} viewBox="0 0 320 56" preserveAspectRatio="none">
        <Path
          d="M -10 20 Q 80 20 120 24 Q 160 28 200 24 Q 240 20 330 20"
          stroke="#013d7d"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={60} cy={20} r={4} fill="#f4f1e8" stroke="#013d7d" strokeWidth={3} />
        <Circle cx={260} cy={20.5} r={4} fill="#f4f1e8" stroke="#013d7d" strokeWidth={3} />

        <Path
          d="M -10 38 Q 80 38 120 33 Q 160 28 200 33 Q 240 38 330 38"
          stroke="#25b890"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={95} cy={35.5} r={4} fill="#f4f1e8" stroke="#25b890" strokeWidth={3} />
        <Circle cx={225} cy={35.5} r={4} fill="#f4f1e8" stroke="#25b890" strokeWidth={3} />
      </Svg>
    );
  }

  if (side === "right") {
    return (
      <Svg width={width} height={height} viewBox="0 0 120 90">
        <Path
          d="M 130 15 L 95 15 L 95 40 L 65 40"
          stroke="#04946d"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={95} cy={15} r={4.5} fill="#f4f1e8" stroke="#04946d" strokeWidth={3.5} />
        <Circle cx={95} cy={40} r={4.5} fill="#f4f1e8" stroke="#04946d" strokeWidth={3.5} />
        <Circle cx={65} cy={40} r={4.5} fill="#f4f1e8" stroke="#04946d" strokeWidth={3.5} />

        <Path
          d="M 130 65 L 100 65 L 75 40 L 75 10"
          stroke="#0abace"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={100} cy={65} r={4.5} fill="#f4f1e8" stroke="#0abace" strokeWidth={3.5} />
        <Circle cx={75} cy={40} r={4.5} fill="#f4f1e8" stroke="#0abace" strokeWidth={3.5} />
        <Circle cx={75} cy={10} r={4.5} fill="#f4f1e8" stroke="#0abace" strokeWidth={3.5} />
      </Svg>
    );
  }

  return (
    <Svg width={width} height={height} viewBox="0 0 120 90">
      <Path
        d="M -10 20 L 20 20 L 45 45 L 45 70"
        stroke="#0abace"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={20} cy={20} r={4.5} fill="#f4f1e8" stroke="#0abace" strokeWidth={3.5} />
      <Circle cx={45} cy={45} r={4.5} fill="#f4f1e8" stroke="#0abace" strokeWidth={3.5} />
      <Circle cx={45} cy={70} r={4.5} fill="#f4f1e8" stroke="#0abace" strokeWidth={3.5} />

      <Path
        d="M -10 60 L 15 60 L 15 5 L 55 5 L 80 30"
        stroke="#25b890"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={15} cy={60} r={4.5} fill="#f4f1e8" stroke="#25b890" strokeWidth={3.5} />
      <Circle cx={15} cy={5} r={4.5} fill="#f4f1e8" stroke="#25b890" strokeWidth={3.5} />
      <Circle cx={55} cy={5} r={4.5} fill="#f4f1e8" stroke="#25b890" strokeWidth={3.5} />
    </Svg>
  );
}
