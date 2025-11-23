export const motivationalQuotes = [
  "The expert in anything was once a beginner.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Don't watch the clock; do what it does. Keep going.",
  "The future depends on what you do today.",
  "Learning never exhausts the mind.",
  "Education is the passport to the future.",
  "The beautiful thing about learning is that no one can take it away from you.",
  "Study hard, for the well is deep, and our brains are shallow.",
  "Focus on being productive instead of busy.",
  "Small progress is still progress.",
  "Every accomplishment starts with the decision to try.",
  "Your limitation—it's only your imagination.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it."
];

export const getRandomQuote = (): string => {
  return motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
};