module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|expo|@expo|@react-native|expo(nent)?|@expo(nent)?/.*)"
  ],
};