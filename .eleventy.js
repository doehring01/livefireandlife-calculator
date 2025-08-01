module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/styles.css");

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "dist"
    }
  };
};

