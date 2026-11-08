// The deck of projects: real repositories from github.com/skaur16. The poster for each lives at /assets/posts/<slug>.jpg
export type Post = {
  slug: string;
  title: string;
  line: string; // may hold <br>
  href: string;
  embed?: string; // an iframe that can play right here, if the host allows it (GitHub repos don't)
};

const gh = (repo: string) => `https://github.com/skaur16/${repo}`;

export const posts: Post[] = [
  { slug: "reviewspot", title: "ReviewSpot", line: "Kotlin, all the way down.<br>Pushed April 2026.", href: gh("ReviewSpot") },
  { slug: "travelbuddy", title: "TravelBuddy", line: "Swift. Trips, their details and expenses, over a REST API with data persistence.", href: gh("TravelBuddy") },
  { slug: "weatherapp", title: "WeatherApp", line: "Swift. One page: your location, and the weather there, from a REST API.", href: gh("WeatherApp") },
  { slug: "eat-n-split", title: "eat-n-split", line: "JavaScript, CSS and HTML.<br>Pushed October 2026.", href: gh("eat-n-split") },
  { slug: "moodsync", title: "MoodSync", line: "Java.<br>Pushed April 2026.", href: gh("MoodSync") },
  { slug: "chitchatapp", title: "ChitChatApp", line: "Kotlin.<br>Pushed June 2025.", href: gh("ChitChatApp") },
];

export const section = {
  heading: "Me on GitHub",
  sub: "Not on my resume, but it should be.",
  aside: ["Pushed.", "Broke prod.", "Pushed again."],
  open: "Open on GitHub",
  view: "View on GitHub",
};
