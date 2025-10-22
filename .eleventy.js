// .eleventy.js
module.exports = function(eleventyConfig) {
  // --- Static assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // --- Jekyll compatibility shims
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
    // Enable BOTH Liquid and Nunjucks so includes like seo.njk work
    htmlTemplateEngine: ["liquid", "njk"],
    markdownTemplateEngine: ["liquid", "njk"],
    dataTemplateEngine: false
  };
};