// .eleventy.js
module.exports = function(eleventyConfig) {
  /* ---------------------------
     Passthrough copies
  ---------------------------- */
  // Copy everything under src/assets → /assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Calculator JS → /calculators/contribution-optimizer/app.js
  eleventyConfig.addPassthroughCopy({
    "src/calculators/contribution-optimizer/app.js":
      "calculators/contribution-optimizer/app.js"
  });

  // ✅ Early Retirement Estimator JS → /calculators/early-retirement-estimator/early-retirement-estimator.js
  eleventyConfig.addPassthroughCopy({
    "src/calculators/early-retirement-estimator/early-retirement-estimator.js":
      "calculators/early-retirement-estimator/early-retirement-estimator.js"
  });

  // Optional Netlify headers file
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });

  // Root stylesheet → /styles.css
  eleventyConfig.addPassthroughCopy({ "src/styles.css": "styles.css" });

  // Helpful during dev; harmless on Netlify
  eleventyConfig.addWatchTarget("src/assets");
  eleventyConfig.addWatchTarget("src/calculators/contribution-optimizer/app.js");
  eleventyConfig.addWatchTarget("src/calculators/early-retirement-estimator/early-retirement-estimator.js");
  eleventyConfig.addWatchTarget("src/styles.css");

  /* ---------------------------
     Jekyll compatibility filters
  ---------------------------- */
  eleventyConfig.addFilter("relative_url", (value) => {
    if (!value) return value;
    return String(value).replace(/([^:]\/)\/+/g, "$1");
  });

  const SITE_URL = (process.env.SITE_URL || "").trim();
  eleventyConfig.addFilter("absolute_url", (value) => {
    if (!value) return value;
    if (!SITE_URL) return value;
    const joined = (SITE_URL.replace(/\/+$/, "") + "/" + String(value).replace(/^\/+/, ""))
      .replace(/([^:]\/)\/+/g, "$1");
    return joined;
  });

  /* ---------------------------
     Collections
  ---------------------------- */
  eleventyConfig.addCollection("livePosts", (collectionApi) => {
    const now = new Date();
    const msPerHour = 3600 * 1000;
    const mtOffsetGuess = 7;
    const mtNow = new Date(now.getTime() - mtOffsetGuess * msPerHour);
    const mtTodayStart = new Date(mtNow.getFullYear(), mtNow.getMonth(), mtNow.getDate());

    return collectionApi
      .getFilteredByGlob([
        "src/blog/*.{md,html,liquid,njk}",
        "src/blog/**/index.{md,html,liquid,njk}"
      ])
      .filter(item => item.url !== "/blog/")
      .filter(item => !item.data.draft)
      .filter(item => {
        const pub = item.data.date || item.date;
        return !pub || (pub <= mtTodayStart);
      })
      .sort((a, b) => {
        const ad = (a.data.date || a.date) ? new Date(a.data.date || a.date).getTime() : 0;
        const bd = (b.data.date || b.date) ? new Date(b.data.date || b.date).getTime() : 0;
        return bd - ad;
      });
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
