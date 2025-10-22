// .eleventy.js
module.exports = function(eleventyConfig) {
  // --- Static assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // --- Jekyll compatibility shims (so old templates with |relative_url / |absolute_url keep working)
  eleventyConfig.addFilter("relative_url", (value) => {
    if (!value) return value;
    // collapse accidental double slashes but keep protocol slashes
    return value.replace(/([^:]\/)\/+/g, "$1");
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
    // Keep Liquid as the engine; njk files won’t be included from Liquid anyway.
    htmlTemplateEngine: "liquid",
    markdownTemplateEngine: "liquid",
    dataTemplateEngine: false
  };
};