export const gameTypes = [
  {
    id: "mainstage",
    name: "Mainstage (90 Ball Bingo)",
    rules: {
      maxPlayers: 100,
      winCondition: "First to complete a row",
    },
    generateNumber: () => Math.floor(Math.random() * 90) + 1,
    customButtons: [],
  },
  {
    id: "party",
    name: "Party (80 Ball Bingo)",
    rules: {
      maxPlayers: 50,
      winCondition: "First to complete a card",
    },
    generateNumber: () => Math.floor(Math.random() * 80) + 1,
    customButtons: [],
  },
  {
    id: "quiz",
    name: "Quiz Bingo",
    rules: {
      maxPlayers: 30,
      winCondition: "Answer all questions correctly",
    },
    generateNumber: () => "Random Question", // Placeholder for question logic
    customButtons: ["Show Answer"],
  },
  {
    id: "logo",
    name: "Logo Bingo",
    rules: {
      maxPlayers: 40,
      winCondition: "Identify all logos",
    },
    generateNumber: () => "Random Logo", // Placeholder for logo logic
    customButtons: ["Show Logo"],
  },
  {
    id: "music",
    name: "Music Bingo",
    rules: {
      maxPlayers: 20,
      winCondition: "Identify all tracks",
    },
    generateNumber: () => "Random Music Clip", // Placeholder for music logic
    customButtons: ["Play Clip"],
  },
];