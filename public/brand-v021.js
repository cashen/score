const PRODUCT_NAME = "高三坐标";
const PRODUCT_TAGLINE = "看见现在的位置，也看见一路的变化";
const BRAND_MARK = "标";

function textOf(node) {
  return node?.textContent?.trim() || "";
}

function applyBrand() {
  document.title = PRODUCT_NAME;

  document.querySelectorAll(".brand-mark").forEach((mark) => {
    if (["迹", "标"].includes(textOf(mark))) mark.textContent = BRAND_MARK;
  });

  const loading = document.querySelector(".loading-screen p");
  if (loading && ["正在准备高三轨迹…", "正在准备高三坐标…"].includes(textOf(loading))) {
    loading.textContent = `正在准备${PRODUCT_NAME}…`;
  }

  document.querySelectorAll(".brand > span").forEach((label) => {
    const current = textOf(label);
    if (current === "高三轨迹") label.textContent = PRODUCT_NAME;
    if (current === "高三轨迹 · 分享页") label.textContent = `${PRODUCT_NAME} · 分享页`;
  });

  const login = document.querySelector(".login-card");
  const loginTitle = login?.querySelector("h1");
  if (textOf(loginTitle) === "高三轨迹") loginTitle.textContent = PRODUCT_NAME;
  const loginIntro = login?.querySelector("h1 + p");
  if (loginIntro && (textOf(loginIntro).startsWith("记录重要考试") || loginIntro.dataset.brandV021 === "1")) {
    loginIntro.dataset.brandV021 = "1";
    loginIntro.textContent = `${PRODUCT_TAGLINE}。记录重要考试，观察孩子在学校里的相对位置变化。成绩默认仅家庭内部可见。`;
  }

  const onboardingBrand = document.querySelector(".onboarding-card .eyebrow");
  if (textOf(onboardingBrand) === "高三轨迹") onboardingBrand.textContent = PRODUCT_NAME;

  document.querySelectorAll(".footer").forEach((footer) => {
    if (textOf(footer).startsWith("高三轨迹 · 数据默认私有")) {
      footer.textContent = footer.textContent.replace(/^高三轨迹/, PRODUCT_NAME);
    }
  });
}

const appRoot = document.querySelector("#app");
applyBrand();

if (appRoot) {
  const observer = new MutationObserver(applyBrand);
  observer.observe(appRoot, { childList: true });
}
