// .eleventy.js
module.exports = function(eleventyConfig) {
  // --- Static assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // --- Jekyll compatibility shims
  eleventyConfig.addFilter("relative_url", (value) => {
    if (!value) return value;
    return value.replace(/([^:]\/)\/+/g, "$1"); // collapse accidental double slashes
  });

  const SITE_URL = process.env.SITE_URL || ""; // e.g. https://livefireandlife.com
  eleventyConfig.addFilter("absolute_url", (value) => {
    if (!value) return value;
    const joined = (SITE_URL.replace(/\/+$/, "") + "/" + value.replace(/^\/+/, ""))
      .replace(/([^:]\/)\/+/g, "$1");
    return joined;
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "_layouts",
      output: "dist"
    },
    htmlTemplateEngine: "liquid",
    markdownTemplateEngine: "liquid",
    dataTemplateEngine: false
  };
};