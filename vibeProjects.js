// Vibe Code Registry Project List
// This file defines the list of projects for the VibeCode.html registry page.

const vibeProjects = [
  {
    name: "MosaicMaker",
    image: "Images/gem2.png",
    link: "MosaicMaker/index.html",
    description: "Create animated mosaics and GIFs with interactive effects. Powered by gif.worker.js."
  },
  {
    name: "FlowerFall",
    image: "Images/flowerfall.png",
    link: "FlowerFall/flowerfall.html",
    description: "Relaxing falling flowers game. Click to interact and change the flow."
  },
  {
    name: "BadFortune",
    image: "Images/fortune.png",
    link: "BadFortune/fortune.html",
    description: "Get a random bad fortune. Dark humor, not for the faint of heart."
  },
  {
    name: "BreakupPhone",
    image: "Images/breakup.png",
    link: "BreakupPhone/breaker.html",
    description: "Simulate a breakup call. For catharsis or just for laughs."
  },
  {
    name: "GreeterTest",
    image: "Images/greeter.png",
    link: "GreeterTest/index.html",
    description: "Chat bubble demo and interactive greeting. Test out the chat UI."
  },
  {
    name: "CardCake",
    image: "Images/cake.png",
    link: "CardCake/index.html",
    description: "Send a digital cake card to someone. Sweet and simple."
  }
];

// Export for use in registry page
if (typeof module !== 'undefined') {
  module.exports = vibeProjects;
}
