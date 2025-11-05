// .eleventy.js
module.exports = function(eleventyConfig) {
  /* ---------------------------
     Passthrough copies
  ---------------------------- */
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });   // if present
  eleventyConfig.addPassthroughCopy({ "src/styles.css": "styles.css" });

  /* ---------------------------
     Jekyll compatibility filters
  ---------------------------- */
  eleventyConfig.addFilter("relative_url", (value) => {
    if (!value) return value;
    // collapse accidental double slashes but keep protocol slashes
    return value.replace(/([^:]\/)\/+/g, "$1");
  });

  const SITE_URL = process.env.SITE_URL || ""; // e.g. https://livefireandlife.com
  eleventyConfig.addFilter("absolute_url", (value) => {
    if (!value) return value;
    const joined = (SITE_URL.replace(/\/+$/, "") + "/" + String(value).replace(/^\/+/, ""))
      .replace(/([^:]\/)\/+/g, "$1");
    return joined;
  });

  /* ---------------------------
     Collections
  ---------------------------- */
  // All blog posts: exclude landing page, drafts, and future-dated; newest first
  eleventyConfig.addCollection("livePosts", (collectionApi) => {
    const now = new Date();
    return collectionApi
      .getFilteredByGlob([
        "src/blog/*.{md,html}",
        "src/blog/**/index.{md,html}"
      ])
      .filter(item => item.url !== "/blog/")          // exclude the landing page itself
      .filter(item => !item.data.draft)               // optional: honor `draft: true`
      .filter(item => item.date && item.date <= now)  // skip future-dated posts
      .sort((a, b) => b.date - a.date);               // newest first
  });

  /* ---------------------------
     Dir & templating engines
  ---------------------------- */
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