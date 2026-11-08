// The eight chapters and the bonus track. Each has a cover, a voice note and the words in it (see captions.ts).
export type Cover =
  | { kind: "place"; key: string; word: string; image: string } // a portrait plate: the name set vertically beside the picture
  | { kind: "plate"; key: string; word: string; image: string; cutout?: string; mask?: string } // the series: one graded picture with the title set over it
  | { kind: "marks"; lines: [string, boolean][]; cutout?: string } // red marker on lined paper: [text, struck through]
  | { kind: "big"; text: string; accent: string; cutout?: string }; // one big question on a dark field

export type Story = {
  title: string;
  meta: string;
  audio: string; // under /assets/audio/
  cover: Cover;
};

export const stories: Story[] = [
  {
    title: "Where it all began",
    meta: "Yes, that Waterloo",
    audio: "note-1.mp3",
    cover: { kind: "place", key: "waterloo", word: "Waterloo", image: "/assets/cover/waterloo.jpg" },
  },
  {
    title: "The first two didn't stick",
    meta: "Two languages, one browser",
    audio: "note-2.mp3",
    cover: { kind: "marks", lines: [["Java", true], ["C++", true], ["JS?!", false]], cutout: "/assets/cut/laptop.webp" },
  },
  {
    title: "8,000 lines from the tutorial",
    meta: "Clean, with tests",
    audio: "note-3.mp3",
    cover: { kind: "plate", key: "lines", word: "8,000 lines", image: "/assets/cover/lines.jpg" },
  },
  {
    title: "First job and a ticket queue",
    meta: "Stayed for the reviews",
    audio: "note-4.mp3",
    cover: { kind: "plate", key: "junior", word: "Junior", image: "/assets/cover/junior.jpg" },
  },
  {
    title: "Bare minimum meetings",
    meta: "Present, technically",
    audio: "note-5.mp3",
    cover: { kind: "plate", key: "standup", word: "Standup", image: "/assets/cover/standup.jpg" },
  },
  {
    title: "A one-way migration",
    meta: "Manager, don't read this",
    audio: "note-6.mp3",
    cover: { kind: "plate", key: "prod", word: "Prod", image: "/assets/cover/prod.jpg" },
  },
  {
    title: "Intro to code, for interns",
    meta: "Tougher than tech leads",
    audio: "note-7.mp3",
    cover: { kind: "plate", key: "mentor", word: "Mentor", image: "/assets/cover/mentor.jpg" },
  },
  {
    title: "The biggest risk is this one",
    meta: "Resume's very proud",
    audio: "note-8.mp3",
    cover: { kind: "big", text: "Stable job", accent: "?", cutout: "/assets/cut/desk.webp" },
  },
  {
    title: "Bonus track",
    meta: "No refunds",
    audio: "bonus.mp3",
    cover: { kind: "plate", key: "bonus", word: "Bonus", image: "/assets/cover/bonus.jpg" },
  },
];
