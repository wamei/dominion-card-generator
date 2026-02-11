let templateSize = 0; //save globally
let images = [];
let imagesLoaded = false;

const OfficialBaseCards = {
  基本: ["銅貨", "銀貨", "金貨", "屋敷", "公領", "属州", "呪い"],
  錬金術: ["ポーション"],
  繁栄: ["白金貨", "植民地"],
};

// Default deck sizes by card type
const DEFAULT_DECK_SIZE = 10; // Portrait cards (size 0, 2, 3)
const DEFAULT_DECK_SIZE_LANDSCAPE = 6; // Landscape cards (size 1)
const DEFAULT_DECK_SIZE_SINGLE = 1; // Pile markers (size 4) and mats (size 5)

// Parallel processing workers count
const PARALLEL_WORKERS = 10;

// Background process queue for iframe-based operations (PDF, images, import)
const backgroundProcessQueue = {
  queue: [],
  isProcessing: false,

  async add(name, total, processFn) {
    // Create progress toast immediately (shows "waiting" if queued)
    const progress = showProgress(this.isProcessing ? `${name}待機中...` : `${name}中...`, total);

    return new Promise((resolve, reject) => {
      this.queue.push({ name, total, processFn, progress, resolve, reject });
      this.processNext();
    });
  },

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const { name, total, processFn, progress, resolve, reject } = this.queue.shift();

    // Update progress title from "waiting" to "processing"
    progress.setTitle(`${name}中...`);

    try {
      const result = await processFn(progress);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isProcessing = false;
      this.processNext();
    }
  },
};

let useCORS = true; // flag to activate loading of external images via CORS helper function -> otherwise canvas is tainted and download button not working
//const CORS_ANYWHERE_BASE_URL = 'https://dominion-card-generator-cors.herokuapp.com/';
//const CORS_ANYWHERE_BASE_URL = 'https://thingproxy.freeboard.io/fetch/';
const CORS_ANYWHERE_BASE_URL = "https://images.weserv.nl/?url="; // image proxy service

const ASCIIPattern = new RegExp("^[\x20-\x7e]*$");

// Toast notification system
function getToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, duration = 3000) {
  const container = getToastContainer();

  // Create toast element
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.prepend(toast);

  // Click to minimize/restore
  toast.addEventListener("click", () => {
    if (toast.classList.contains("toast-minimized")) {
      toast.classList.remove("toast-minimized");
      toast.classList.add("toast-restored");
      toast.addEventListener(
        "animationend",
        () => {
          toast.classList.remove("toast-restored");
        },
        { once: true },
      );
    } else {
      toast.classList.add("toast-minimized");
    }
  });

  // Auto-dismiss after duration
  setTimeout(() => {
    toast.classList.add("toast-exit");
    toast.addEventListener("animationend", () => {
      toast.remove();
      // Remove container if empty
      if (container.children.length === 0) {
        container.remove();
      }
    });
  }, duration);
}

// Custom alert modal
function showAlert(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";

    const modal = document.createElement("div");
    modal.className = "confirm-modal";

    const messageEl = document.createElement("div");
    messageEl.className = "confirm-message";
    messageEl.textContent = message;

    const buttons = document.createElement("div");
    buttons.className = "confirm-buttons";

    const okBtn = document.createElement("button");
    okBtn.className = "confirm-btn confirm-btn-cancel";
    okBtn.textContent = "OK";

    okBtn.onclick = () => {
      overlay.remove();
      resolve();
    };

    buttons.appendChild(okBtn);
    modal.appendChild(messageEl);
    modal.appendChild(buttons);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.activeElement.blur();
  });
}

// Custom confirm modal
function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";

    const modal = document.createElement("div");
    modal.className = "confirm-modal";

    const messageEl = document.createElement("div");
    messageEl.className = "confirm-message";
    messageEl.textContent = message;

    const buttons = document.createElement("div");
    buttons.className = "confirm-buttons";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "confirm-btn confirm-btn-cancel";
    cancelBtn.textContent = "キャンセル";

    const okBtn = document.createElement("button");
    okBtn.className = "confirm-btn confirm-btn-ok";
    okBtn.textContent = "OK";

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    cancelBtn.onclick = () => close(false);
    okBtn.onclick = () => close(true);

    buttons.appendChild(cancelBtn);
    buttons.appendChild(okBtn);
    modal.appendChild(messageEl);
    modal.appendChild(buttons);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.activeElement.blur();
  });
}

// Progress toast for long-running operations
function showProgress(title, total) {
  const container = getToastContainer();

  const toast = document.createElement("div");
  toast.className = "toast toast-progress";
  toast.innerHTML = `
    <div class="toast-progress-title">${title}</div>
    <div class="toast-progress-bar"><div class="toast-progress-bar-fill" style="width: 0%"></div></div>
    <div class="toast-progress-text">0 / ${total}</div>
  `;
  container.prepend(toast);

  // Click to minimize/restore
  toast.addEventListener("click", () => {
    if (toast.classList.contains("toast-minimized")) {
      toast.classList.remove("toast-minimized");
      toast.classList.add("toast-restored");
      toast.addEventListener(
        "animationend",
        () => {
          toast.classList.remove("toast-restored");
        },
        { once: true },
      );
    } else {
      toast.classList.add("toast-minimized");
    }
  });

  return {
    update(current, status) {
      const percent = Math.round((current / total) * 100);
      toast.querySelector(".toast-progress-bar-fill").style.width = percent + "%";
      toast.querySelector(".toast-progress-text").textContent = status || `${current} / ${total}`;
    },
    setTitle(newTitle) {
      toast.querySelector(".toast-progress-title").textContent = newTitle;
    },
    close() {
      toast.classList.add("toast-exit");
      toast.addEventListener("animationend", () => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      });
    },
  };
}

Array.prototype.remove = function () {
  var what,
    a = arguments,
    L = a.length,
    ax;
  while (L && this.length) {
    what = a[--L];
    while ((ax = this.indexOf(what)) !== -1) {
      this.splice(ax, 1);
    }
  }
  return this;
};

function copy(x) {
  return JSON.parse(JSON.stringify(x));
}

// Initialization of complete logic on load of page
function initCardImageGenerator() {
  //these three can all be expanded as you see fit
  var icons = {
    //the names should match the image filenames (plus a .png extension).
    "@": ["Debt", "white", "Treasure", "負債"],
    "\\^": ["Potion", "white", "Treasure", "ポーション"],
    "%": ["VP", "white", "Victory", "勝利点"],
    "#": ["VP-Token", "white", "Victory", "勝利点トークン"], //German VP Token (not a nice decision of ASS Altenburger, but maybe nice to have to keep the cards consistent)
    "\\$": ["Coin", "black", "Treasure", "コイン"],
    "\\*": ["Sun", "black", "Treasure", "太陽"],
    "§": ["Custom Icon", "white", "Treasure", "カスタムアイコン"],
  };
  var iconsInPrice = icons;
  delete iconsInPrice["\\*"];
  var normalColorFactorLists = [
    ["アクション/イベント", [1, 1, 1]],
    ["財宝", [1.1, 0.95, 0.55]],
    ["勝利点", [0.75, 0.9, 0.65]],
    ["リアクション", [0.65, 0.8, 1.05]],
    ["持続", [1.2, 0.8, 0.4]],
    ["リザーブ", [0.9, 0.75, 0.5]],
    ["呪い", [0.85, 0.6, 1.1]],
    ["避難所", [1.05, 0.65, 0.5]],
    ["廃墟", [0.75, 0.6, 0.35]],
    ["ランドマーク", [0.45, 1.25, 0.85]],
    ["夜行", [0.3, 0.4, 0.45]],
    ["祝福", [1.4, 1.35, 0.55, 0, 0, 0, 1.7, 1.25, 0.65, 1.95, 1.6, 0.4]],
    ["呪詛", [0.75, 0.6, 2.1, 0, 0, 0, 0.8, 0.8, 0.8, 1.0, 0.75, 2.1]],
    ["状態", [1.1, 1.3, 1.3, 0.6, 0.15, 0, 1.55, 1.15, 1.05, 1.4, 0.65, 0.45]],
    ["アーティファクト", [1.15, 1, 0.75, 0.3, 0.15, 0.05]],
    ["プロジェクト", [1.15, 0.95, 0.9, 0.4, 0.2, 0.15]],
    ["習性", [1, 1.15, 1.25, 0.25, 0.3, 0.35, 1.6, 1.6, 1.6, 1.3, 1.3, 1.3]],
    ["同盟", [1, 0.95, 0.85, 0.35, 0.3, 0.15, 0.9, 0.8, 0.7, 0.9, 0.8, 0.7]],
    ["特性", [0.95, 0.8, 1.1, 0.3, 0.25, 0.35, 1.6, 1.6, 1.6, 1.3, 1.3, 1.3]],
    ["予言", [0.6, 1.0, 1.2, 0.1, 0.2, 0.3, 1.1, 1.1, 1.1, 0.6, 0.6, 0.6]],
    ["装備品", [0.9, 0.65, 0.4]],
  ];
  var boldableKeywords = [
    //case-insensitive
    "cards",
    "card",
    "カードを引く",
    "buys",
    "buy",
    "カードを購入",
    "購入",
    "actions",
    "action",
    "アクション",
    "coffers",
    "coffer",
    "財源",
    "villagers",
    "villager",
    "村人",
    "好意",

    "aktion",
    "aktionen",
    "karte",
    "karten",
    "kauf",
    "käufe",
    "dorfbewohner",
    "münze",
    "münzen",
  ];
  var specialBoldableKeywords = ["favor", "gefallen"];
  var travellerTypesPattern = new RegExp(["Traveller", "Traveler", "Reisender", "Reisende", "Reiziger", "Matkaaja", "Itinérant", "Путешественник", "Приключенец"].join("|"));

  var normalColorCustomIndices = [0, 0];
  var normalColorDropdowns = document.getElementsByName("normalcolor");
  for (var j = 0; j < normalColorDropdowns.length; ++j) {
    for (var i = 0; i < normalColorFactorLists.length; ++i) {
      //"- j" because only the first dropdown should have Night
      var option = document.createElement("option");
      option.textContent = normalColorFactorLists[i][0];
      normalColorDropdowns[j].appendChild(option);
    }
    normalColorCustomIndices[j] = normalColorDropdowns[j].childElementCount;
    var customOption = document.createElement("option");
    customOption.textContent = "カスタム";
    normalColorDropdowns[j].appendChild(customOption);
    customOption = document.createElement("option");
    customOption.textContent = "エクストラカスタム";
    normalColorDropdowns[j].appendChild(customOption);
    normalColorDropdowns[j].selectedIndex = 0;
  }
  //var templateSize = 0;

  function rebuildBoldLinePatternWords() {
    let elemBoldkeys = document.getElementById("boldkeys");
    let customBoldableKeywords = elemBoldkeys !== null ? elemBoldkeys.value : "";
    let boldableKeywordsFull = customBoldableKeywords.length > 0 ? boldableKeywords.concat(customBoldableKeywords.split(";")) : boldableKeywords;
    boldableKeywordsFull.forEach(function (word, index) {
      this[index] = word.trim();
    }, boldableKeywordsFull);
    boldLinePatternWords = RegExp("(?:([-+]\\d+)\\s+|(\\+))(" + boldableKeywordsFull.join("|") + "s?)", "ig");
    boldLinePatternWordsSpecial = RegExp("(?:([-+]\\d+)\\s+|(?:(\\d+)\\s+)|(\\+)|)(" + specialBoldableKeywords.join("|") + "s?)", "ig");
  }
  var boldLinePatternWords;
  var boldLinePatternWordsSpecial;
  rebuildBoldLinePatternWords();

  var iconList = "[" + Object.keys(icons).join("") + "]";
  //var boldLinePatternIcons = RegExp("[-+]\\d+\\s" + iconList + "\\d+", "ig");
  var iconWithNumbersPattern = "[-+]?(" + iconList + ")([\\d\\?]*[-+\\*]?)";
  var iconWithNumbersPatternSingle = RegExp("^([-+]?\\d+)?" + iconWithNumbersPattern + "(\\S*)$");
  var iconWithNumbersPatternRep = "[-+]?[\\d\\?]*(" + iconList + ")([\\d\\?]*[-+\\*]?)";
  iconWithNumbersPattern = RegExp(iconWithNumbersPattern, "g");
  iconWithNumbersPatternRep = RegExp(iconWithNumbersPatternRep, "g");

  var boldStartMarkerPattern = "\\[b\\]";
  var boldEndMarkerPattern = "\\[/b\\]";
  var italicStartMarkerPattern = "\\[i\\]";
  var italicEndMarkerPattern = "\\[/i\\]";
  var underlineStartMarkerPattern = "\\[u\\]";
  var underlineEndMarkerPattern = "\\[/u\\]";
  var boldMarkerPattern = RegExp(boldStartMarkerPattern + "|" + boldEndMarkerPattern, "g");
  var italicMarkerPattern = RegExp(italicStartMarkerPattern + "|" + italicEndMarkerPattern, "g");
  var underlineMarkerPattern = RegExp(underlineStartMarkerPattern + "|" + underlineEndMarkerPattern, "g");
  var boldStartMarkerPattern = RegExp(boldStartMarkerPattern, "g");
  var boldEndMarkerPattern = RegExp(boldEndMarkerPattern, "g");
  var italicStartMarkerPattern = RegExp(italicStartMarkerPattern, "g");
  var italicEndMarkerPattern = RegExp(italicEndMarkerPattern, "g");
  var underlineStartMarkerPattern = RegExp(underlineStartMarkerPattern, "g");
  var underlineEndMarkerPattern = RegExp(underlineEndMarkerPattern, "g");

  var canvases = document.getElementsByClassName("myCanvas");

  var canvases = document.getElementsByClassName("myCanvas");

  var recolorFactorList = [
    [0.75, 1.1, 1.35, 0, 0, 0, 1, 2, 3, 4, 5, 6],
    [0.75, 1.1, 1.35, 0, 0, 0, 1, 2, 3, 4, 5, 6],
  ];

  var normalColorCurrentIndices = [0, 0];
  var recoloredImages = [];

  function draw() {
    function getRecoloredImage(imageID, colorID, offset) {
      if (!recoloredImages[imageID]) {
        //http://stackoverflow.com/questions/1445862/possible-to-use-html-images-like-canvas-with-getimagedata-putimagedata
        var cnvs = document.createElement("canvas");
        var w = images[imageID].width,
          h = images[imageID].height;
        cnvs.width = w;
        cnvs.height = h;
        var ctx = cnvs.getContext("2d");
        ctx.drawImage(images[imageID], 0, 0);

        var imgdata = ctx.getImageData(0, 0, w, h);
        var rgba = imgdata.data;

        offset = offset || 0;
        var recolorFactors;
        if (normalColorCurrentIndices[colorID] === normalColorCustomIndices[colorID]) recolorFactors = recolorFactorList[colorID].slice(0, 3);
        else if (normalColorCurrentIndices[colorID] > normalColorCustomIndices[colorID]) recolorFactors = recolorFactorList[colorID];
        else recolorFactors = normalColorFactorLists[normalColorCurrentIndices[colorID] - colorID][1];
        recolorFactors = recolorFactors.slice();

        while (recolorFactors.length < 6) recolorFactors.push(0);

        if (offset == 0) {
          for (var ch = 0; ch < 3; ++ch) recolorFactors[ch] -= recolorFactors[ch + 3];
          for (var px = 0, ct = w * h * 4; px < ct; px += 4)
            if (rgba[px + 3])
              //no need to recolor pixels that are fully transparent
              for (var ch = 0; ch < 3; ++ch) rgba[px + ch] = Math.max(0, Math.min(255, Math.round(recolorFactors[ch + 3] * 255 + rgba[px + ch] * recolorFactors[ch])));
        } else {
          while (recolorFactors.length < 12) recolorFactors.push(genericCustomAccentColors[templateSize & 1][recolorFactors.length]);
          for (var px = 0, ct = w * h * 4; px < ct; px += 4) if (rgba[px + 3]) for (var ch = 0; ch < 3; ++ch) rgba[px + ch] = Math.max(0, Math.min(255, rgba[px + ch] * recolorFactors[ch + offset]));
        }

        ctx.putImageData(imgdata, 0, 0);
        recoloredImages[imageID] = cnvs;
      }
      return recoloredImages[imageID];
    }

    var iconReplacedWithSpaces = "   ";

    function getWidthOfLineWithIconsReplacedWithSpaces(line) {
      return context.measureText(line.replace(iconWithNumbersPattern, iconReplacedWithSpaces)).width;
    }

    function getIconListing(icon) {
      return icons[icon] || icons["\\" + icon];
    }
    var shadowDistance = 10;
    var italicSubstrings = ["Heirloom: ", "家宝: ", "Erbstück: "];

    function writeLineWithIconsReplacedWithSpaces(line, x, y, scale, family, boldSize) {
      boldSize = boldSize || 64;
      context.textAlign = "left";

      if (italicSubstrings.some((substring) => line.includes(substring))) {
        context.font = "italic " + context.font;
        line = line.replace(" ", "\xa0");
      } else {
        context.font = context.font.replace("italic ", "");
      }

      var words = line.split(" ");
      var isBold = false;
      var isItalic = false;
      var isUnderline = false;
      function isSingle(words) {
        return words.length === 3 && words[0] === "[b]" && words[2] === "[/b]";
      }
      for (var i = 0; i < words.length; ++i) {
        var word = words[i];
        if (word.match(boldStartMarkerPattern)) {
          isBold = true;
          continue;
        }
        if (word.match(boldEndMarkerPattern)) {
          isBold = false;
          continue;
        }
        if (word.match(italicStartMarkerPattern)) {
          isItalic = true;
          continue;
        }
        if (word.match(italicEndMarkerPattern)) {
          isItalic = false;
          continue;
        }
        if (word.match(underlineStartMarkerPattern)) {
          isUnderline = true;
          continue;
        }
        if (word.match(underlineEndMarkerPattern)) {
          isUnderline = false;
          continue;
        }
        context.save();
        while (word) {
          var match = word.match(iconWithNumbersPatternSingle);
          if (match) {
            var familyOriginal = family;
            family = "mySpecials";
            var localY = y;
            var localScale = scale;
            if (words.length === 3 && !word.startsWith("+")) {
              localY += 115 - scale * 48;
              context.font = "bold 192pt " + family;
              localScale = 1.6;
              if (templateSize === 3) {
                context.font = "bold 222pt " + family;
                if (word.includes("$")) {
                  // Treasure Base cards
                  localScale = localScale * 2;
                } else {
                  localScale = localScale * 1.5;
                }
              } else {
                x = x + 128 * scale;
              }
            }
            var halfWidthOfSpaces = context.measureText(iconReplacedWithSpaces).width / 2 + 2;

            var image = false;
            var iconKeys = Object.keys(icons);
            for (var j = 0; j < iconKeys.length; ++j) {
              if (iconKeys[j].replace("\\", "") == match[2]) {
                image = images[numberFirstIcon + j];
                break;
              }
            }

            context.save();
            if (!match[1] && (match[0].charAt(0) === "+" || match[0].charAt(0) === "-")) {
              match[1] = match[0].charAt(0);
            }
            if (match[1]) {
              if (context.font[0] !== "b") context.font = "bold " + context.font;
              var plus = match[1];
              context.fillText(plus, x, localY);
              x += context.measureText(plus).width + 10 * localScale;
              x += context.measureText(" ").width;
            } else {
              if (!isSingle(words) && !(words.length === 2 && words[1] === "")) {
                x += context.measureText(" ").width;
              }
            }

            x += halfWidthOfSpaces;

            context.translate(x, localY);
            context.scale(localScale * 1.2, localScale * 1.2);
            if (image && image.height) {
              //exists
              //context.shadowColor = "#000";
              context.shadowBlur = 25;
              context.shadowOffsetX = localScale * shadowDistance;
              context.shadowOffsetY = localScale * shadowDistance;
              context.drawImage(image, image.width / -2, image.height / -2);
              context.shadowColor = "transparent";
            } //else... well, that's pretty weird, but so it goes.
            if (match[3]) {
              //text in front of image
              context.textAlign = "center";
              context.fillStyle = getIconListing(match[2])[1];
              let cost = match[3];
              let bigNumberScale = 1;
              let nx = localScale > 1.4 ? 0 : (-5 * localScale) ^ 2;
              let ny = localScale > 1 ? 6 * localScale : localScale > 0.7 ? 12 * localScale : localScale > 0.5 ? 24 * localScale : 48 * localScale;
              if (localScale > 3) {
                bigNumberScale = 0.8;
                ny -= (115 * 0.2) / 2;
              }
              if (cost.length >= 2) {
                // special handling for overpay and variable costs
                let specialCost = cost.slice(-1);
                let specialCostSize = 45;
                let syShift = 0;
                if (specialCost === "*") {
                  //specialCost = '✱';
                  specialCostSize = 65;
                  syShift = 10;
                  if (cost.length > 2) {
                    bigNumberScale = 1.5 / (cost.length - 1);
                  }
                } else if (specialCost === "+") {
                  specialCost = "✚";
                  specialCostSize = 40;
                  if (cost.length > 2) {
                    bigNumberScale = 1.5 / (cost.length - 1);
                  }
                } else {
                  specialCost = null;
                  bigNumberScale = 1.5 / cost.length;
                }
                if (specialCost != null) {
                  cost = cost.slice(0, -1) + " ";
                  context.font = "bold " + specialCostSize + "pt " + family;
                  let sx = localScale > 1 ? (45 / 2) * localScale : 45 * localScale;
                  let sy = localScale > 1 ? -20 * localScale : 12 * localScale - 35 * localScale;
                  if (cost.length >= 3) {
                    nx -= (specialCostSize * 1) / 3;
                    sx += (specialCostSize * 1) / 3;
                  }
                  sy += syShift * localScale;
                  context.fillText(specialCost, sx, sy);
                }
              }
              context.font = "bold " + 115 * bigNumberScale + "pt " + family;
              context.fillText(cost, nx, ny);
              //context.strokeText(match[3], 0, 0);
            }
            context.restore();
            family = familyOriginal;

            x += halfWidthOfSpaces;
            if (!isSingle(words)) {
              x += context.measureText(" ").width;
            }
            word = match[4];
          } else {
            if (isBold) {
              if (isSingle(words)) {
                context.font = "bold " + boldSize + "pt myText";
              } else {
                context.font = "bold " + context.font;
              }
            }
            if (isItalic) {
              context.font = "italic " + context.font;
            }
            if (isUnderline) {
              var measureText = context.measureText(word);
              context.fillRect(x, y + measureText.fontBoundingBoxDescent + 4, measureText.width, 4);
            }
            context.fillText(word, x, y);

            break; //don't start this again
          }
        }
        x += context.measureText(word).width;
        context.restore();
      }
    }

    function writeSingleLine(line, x, y, maxWidth, initialSize, family) {
      family = line.match(ASCIIPattern) && !line.match(iconWithNumbersPattern) ? "myTitleEn" : family || "myTitle";
      var size = (initialSize || 85) + 2;
      do {
        context.font = (size -= 2) + "pt " + family;
      } while (maxWidth && getWidthOfLineWithIconsReplacedWithSpaces(line) > maxWidth);
      writeLineWithIconsReplacedWithSpaces(line, x - getWidthOfLineWithIconsReplacedWithSpaces(line) / 2, y, size / 90, family);
    }

    function writeDescription(elementID, xCenter, yCenter, maxWidth, maxHeight, boldSize) {
      rebuildBoldLinePatternWords();
      var description =
        document
          .getElementById(elementID)
          .value.replace(/ *\n */g, "\n")
          .replace(boldMarkerPattern, " $& ")
          .replace(italicMarkerPattern, " $& ")
          .replace(underlineMarkerPattern, " $& ")
          .replace(iconWithNumbersPatternRep, " $& ")
          .replace(boldLinePatternWords, " $1\xa0$2$3 ")
          .replace(boldLinePatternWordsSpecial, "$1$2\xa0$3$4") + " \n"; //separate newlines into their own words for easier processing
      var lines;
      var widthsPerLine;
      var heightsPerLine;
      var centeredLines;
      var overallHeight;
      var size = parseInt(document.getElementById("descriptionFontSize").value) + 1;
      var heightSize = 10;
      var descriptions = description.split("\n");

      do {
        lines = [];
        widthsPerLine = [];
        heightsPerLine = [];
        centeredLines = [];
        overallHeight = 0;

        size -= 1;
        context.font = size + "pt myText";
        for (var i = 0; i < descriptions.length; ++i) {
          var blocks = descriptions[i].trim().split(" ");
          var line = "";
          var heightToAdd = 0;
          var centered = false;
          var progressiveWidth = 0;
          if (blocks.length === 1 && blocks[0] === "") {
            heightToAdd = (size + heightSize) * 0.5;
            line = "";
          } else if (blocks.length === 1 && blocks[0] === "-") {
            heightToAdd = (size + heightSize) * 1.1;
            line = "-";
          } else if (blocks.length === 1 && (blocks[0].match(iconWithNumbersPattern) || blocks[0].match(boldLinePatternWords) || blocks[0].match(boldLinePatternWordsSpecial))) {
            line = blocks[0];
            centered = true;
            if (line.startsWith("+")) {
              heightToAdd = (boldSize + heightSize * 2) * 1.433;
              var properFont = context.font;
              context.font = "bold " + boldSize + "pt myText"; //resizing up to 64
              progressiveWidth = context.measureText(line).width; //=, not +=
              context.font = properFont;
            } else if (line.match(iconWithNumbersPatternSingle)) {
              heightToAdd = 275;
              var properFont = context.font;
              context.font = "bold 192pt myText";
              progressiveWidth = getWidthOfLineWithIconsReplacedWithSpaces(line); //=, not +=
              context.font = properFont;
            }
            line = `[b] ${line} [/b]`;
          } else {
            var isBoldMarker = false;
            var isItalicMarker = false;
            var isUnderlineMarker = false;
            for (var j = 0; j < blocks.length; ++j) {
              var isBold = false;
              var isItalic = false;
              var isUnderline = false;
              var block = blocks[j];
              var properFont = context.font;
              if (block.match(boldStartMarkerPattern)) {
                isBoldMarker = true;
                continue;
              } else if (block.match(boldEndMarkerPattern)) {
                isBoldMarker = false;
                context.font = properFont;
                continue;
              } else if (block.match(italicStartMarkerPattern)) {
                isItalicMarker = true;
                continue;
              } else if (block.match(italicEndMarkerPattern)) {
                isItalicMarker = false;
                context.font = properFont;
                continue;
              } else if (block.match(underlineStartMarkerPattern)) {
                isUnderlineMarker = true;
                continue;
              } else if (block.match(underlineEndMarkerPattern)) {
                isUnderlineMarker = false;
                context.font = properFont;
                continue;
              }
              if (isBoldMarker || block.match(boldLinePatternWords) || block.match(boldLinePatternWordsSpecial) || block.match(iconWithNumbersPattern)) {
                isBold = true;
                heightToAdd = (size + heightSize) * 1.433;
                context.font = "bold " + size + "pt myText";
              } else {
                heightToAdd = (size + heightSize) * 1.433;
              }
              if (isItalicMarker) {
                isItalic = true;
              }
              if (isUnderlineMarker) {
                isUnderline = true;
              }
              if (block.match(ASCIIPattern) && !block.match(iconWithNumbersPattern)) {
                var widthOfSpace = getWidthOfLineWithIconsReplacedWithSpaces(" ");
                var width = getWidthOfLineWithIconsReplacedWithSpaces(block);
                if (progressiveWidth + width + widthOfSpace > maxWidth) {
                  var lineToAdd = line;
                  lines.push(lineToAdd);
                  line = block;
                  heightToAdd = size * 1.433;
                  widthsPerLine.push(progressiveWidth);
                  centeredLines.push(centered);
                  overallHeight += heightToAdd;
                  heightsPerLine.push(heightToAdd);
                  progressiveWidth = width;
                } else {
                  if (line.length) {
                    line += "\xa0";
                    progressiveWidth += widthOfSpace;
                  }
                  line += block;
                  var properFont = context.font;
                  if (block.match(boldLinePatternWords) || block.match(boldLinePatternWordsSpecial))
                    //e.g. "+1 Action"
                    context.font = "bold " + properFont;
                  progressiveWidth += getWidthOfLineWithIconsReplacedWithSpaces(block);
                  context.font = properFont;
                }
                centered = true;
              } else {
                for (var k = 0; k < block.length; ++k) {
                  var append = block[k];
                  var width = context.measureText(append).width;
                  if (isBold && k === 0) {
                    line += " [b] ";
                  }
                  if (isItalic && k === 0) {
                    line += " [i] ";
                  }
                  if (isUnderline && k === 0) {
                    line += " [u] ";
                  }
                  if (block.match(iconWithNumbersPattern)) {
                    width = context.measureText(block + " ").width;
                    append = block;
                    k = block.length;
                  }
                  if (
                    !["、", "。", ",", ".", "！", "？", "!", "?", "）", "」", "】", "』", ")", "ー", "っ", "ゃ", "ゅ", "ょ", "ッ", "ャ", "ュ", "ョ"].includes(block[k]) &&
                    progressiveWidth + width > maxWidth
                  ) {
                    var lineToAdd = line;
                    var widthToAdd = progressiveWidth;
                    if (["（", "「", "【", "『", "(", "+", "-"].includes(block[k - 1])) {
                      lineToAdd = line.slice(0, -1);
                      var prevWidth = context.measureText(block[k - 1]).width;
                      widthToAdd -= prevWidth;
                      line = block[k - 1] + append;
                      progressiveWidth = prevWidth + width;
                    } else {
                      line = append;
                      progressiveWidth = width;
                    }
                    if (isBold) {
                      lineToAdd = lineToAdd + " [/b]";
                      line = "[b] " + line;
                    }
                    if (isItalic) {
                      lineToAdd = lineToAdd + " [/i]";
                      line = "[i] " + line;
                    }
                    if (isUnderline) {
                      lineToAdd = lineToAdd + " [/u]";
                      line = "[u] " + line;
                    }
                    lines.push(lineToAdd);
                    centeredLines.push(centered);
                    widthsPerLine.push(widthToAdd);
                    overallHeight += heightToAdd;
                    heightsPerLine.push(heightToAdd);
                  } else {
                    line += append;
                    progressiveWidth += width;
                  }
                }
              }
              if (isBold) {
                line += " [/b] ";
              }
              if (isItalic) {
                line += " [/i] ";
              }
              if (isUnderline) {
                line += " [/u] ";
              }
              context.font = properFont;
            }
          }
          lines.push(line);
          centeredLines.push(centered);
          widthsPerLine.push(progressiveWidth);
          heightsPerLine.push(heightToAdd);
          overallHeight += heightToAdd;
        }
      } while (overallHeight > maxHeight && size > 16);

      var y = yCenter - (overallHeight - (size + heightSize) * 1.433) / 2;
      //var barHeight = size / 80 * 10;
      for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];
        if (line === "-")
          //horizontal bar
          context.fillRect(xCenter / 2, y - size * 0.375 - 5, xCenter, 10);
        else if (line.length) writeLineWithIconsReplacedWithSpaces(line, centeredLines[i] ? xCenter - widthsPerLine[i] / 2 : xCenter - maxWidth / 2, y, size / 96, "myText", boldSize);
        //else empty line with nothing to draw
        y += heightsPerLine[i];
      }
      context.fillStyle = "black";
    }

    function writeIllustrationCredit(x, y, color, bold, size = 31) {
      var illustrationCredit = document.getElementById("credit").value;
      if (illustrationCredit) {
        context.font = bold + size + "pt myCredit";
        context.fillStyle = color;
        context.fillText(illustrationCredit, x, y);
        context.fillStyle = "#000";
      }
    }

    function writeCreatorCredit(x, y, color, bold, size = 31) {
      var creatorCredit = document.getElementById("creator").value;
      if (creatorCredit) {
        context.textAlign = "right";
        context.font = bold + size + "pt myCredit";
        context.fillStyle = color;
        context.fillText(creatorCredit, x, y);
        context.fillStyle = "#000";
      }
    }

    if (!imagesLoaded) {
      imagesLoaded = (function () {
        for (var i = 0; i < images.length; ++i)
          if (!images[i].complete) {
            return false;
          }
        return true;
      })();
      if (!imagesLoaded) {
        queueDraw();
        return;
      }
    } //else ready to draw!

    canvases[0].parentNode.setAttribute("data-status", "Redrawing...");

    // clear
    for (var i = 0; i < canvases.length; ++i) canvases[i].getContext("2d").clearRect(0, 0, canvases[i].width, canvases[i].height);

    var context;
    if (templateSize === 0 || templateSize === 2 || templateSize === 3) {
      context = canvases[0].getContext("2d");
    } else if (templateSize === 1 || templateSize === 4) {
      context = canvases[1].getContext("2d");
    } else {
      context = canvases[2].getContext("2d");
    }

    //context.save();

    // draw

    var picture = images[5];
    var pictureX = document.getElementById("picture-x").value;
    var pictureY = document.getElementById("picture-y").value;
    var pictureZoom = document.getElementById("picture-zoom").value;
    var expansion = images[17];
    var typeLine = document.getElementById("type").value;
    var heirloomLine = document.getElementById("type2").value;
    var previewLine = document.getElementById("preview").value;
    var cardTitle = document.getElementById("title").value.replace(/\*+$/, "");
    var priceLine = document.getElementById("price").value;
    var numberPriceIcons = (priceLine.match(new RegExp("[" + Object.keys(iconsInPrice).join("") + "]", "g")) || []).length;

    var isEachColorDark = [false, false];
    for (var i = 0; i < 2; ++i)
      isEachColorDark[i] =
        i == 1 && normalColorCurrentIndices[1] == 0
          ? isEachColorDark[0]
          : (normalColorCurrentIndices[i] >= normalColorCustomIndices[i] ? recolorFactorList[i] : normalColorFactorLists[normalColorCurrentIndices[i] - i][1])
              .slice(0, 3)
              .reduce(function getSum(total, num) {
                return total + parseFloat(num);
              }) <= 1.5;
    var differentIntensities = isEachColorDark[0] != isEachColorDark[1];

    if (!(differentIntensities || parseInt(normalColorCurrentIndices[1]) == 0 || parseInt(normalColorCurrentIndices[0]) + 1 == parseInt(normalColorCurrentIndices[1]))) {
      document.getElementById("color2splitselector").removeAttribute("style");
    } else {
      document.getElementById("color2splitselector").setAttribute("style", "display:none");
    }

    function drawPicture(xCenter, yCenter, width, height) {
      if (picture.height) {
        var scale;
        if (picture.width / width > picture.height / height) {
          //size of area to draw picture to
          scale = height / picture.height;
        } else {
          scale = width / picture.width;
        }

        let sizeX = picture.width * scale * pictureZoom;
        let sizeY = picture.height * scale * pictureZoom;
        let spaceX = sizeX - width;
        let spaceY = sizeY - height;
        let moveX = (parseFloat(pictureX) * spaceX) / 2;
        let moveY = (parseFloat(pictureY) * spaceY) / 2;

        context.save();
        context.translate(xCenter + moveX, yCenter + moveY);
        context.scale(scale * pictureZoom, scale * pictureZoom);
        context.drawImage(picture, picture.width / -2, picture.height / -2);
        context.restore();
      }
    }

    function removeCorners(width, height, radius) {
      context.clearRect(0, 0, radius, radius);
      context.clearRect(width - radius, 0, radius, radius);
      context.clearRect(0, height - radius, radius, radius);
      context.clearRect(width - radius, height - radius, radius, radius);
    }

    function drawExpansionIcon(xCenter, yCenter, width, height) {
      if (expansion.height) {
        var scale;
        if (expansion.width / width < expansion.height / height) {
          //size of area to draw picture to
          scale = height / expansion.height;
        } else {
          scale = width / expansion.width;
        }
        context.save();
        context.translate(xCenter, yCenter);
        context.scale(scale, scale);
        context.drawImage(expansion, expansion.width / -2, expansion.height / -2);
        context.restore();
      }
    }

    if (templateSize == 0) {
      //card
      drawPicture(704, 706, 1150, 835);
      removeCorners(1403, 2151, 100);

      context.drawImage(getRecoloredImage(0, 0), 0, 0); //CardColorOne
      if (normalColorCurrentIndices[1] > 0) {
        //two colors are different
        let splitPosition = document.getElementById("color2split").value;
        if (splitPosition == 27) {
          context.drawImage(getRecoloredImage(1, 1), 0, 0); //CardColorTwo - Half
          context.drawImage(images[27], 0, 0); //CardColorThree
        } else {
          context.drawImage(getRecoloredImage(!differentIntensities ? splitPosition : 12, 1), 0, 0); //CardColorTwo
        }
      }
      context.drawImage(getRecoloredImage(2, 0, 6), 0, 0); //CardGray
      context.drawImage(getRecoloredImage(16, 0, 9), 0, 0); //CardBrown
      if (normalColorCurrentIndices[0] > 0 && !isEachColorDark[0] && normalColorCurrentIndices[1] == 0)
        //single (non-Action, non-Night) color
        context.drawImage(images[3], 44, 1094); //DescriptionFocus

      if (travellerTypesPattern.test(typeLine) || document.getElementById("traveller").checked) {
        context.save();
        context.globalCompositeOperation = "luminosity";
        if (isEachColorDark[0]) context.globalAlpha = 0.33;
        context.drawImage(images[4], 524, 1197); //Traveller
        context.restore();
      }

      context.textAlign = "center";
      context.textBaseline = "middle";
      //context.font = "small-caps" + context.font;
      if (heirloomLine) {
        context.drawImage(images[13], 97, 1720); //Heirloom banner
        writeSingleLine(heirloomLine, 701, 1799, 1040, 40, "myTitle");
      }
      if (isEachColorDark[1]) context.fillStyle = "white";
      writeSingleLine(cardTitle, 701, 215, previewLine ? 800 : 1180, 75);
      if (typeLine.split(" - ").length >= 4) {
        let types2 = typeLine.split(" - ");
        let types1 = types2.splice(0, Math.ceil(types2.length / 2));
        let left = priceLine ? 750 + 65 * (numberPriceIcons - 1) : 701;
        let right = priceLine ? 890 - 65 * (numberPriceIcons - 1) : 1180;
        writeSingleLine(types1.join(" - ") + " -", left, 1922 - 26, right, 42);
        writeSingleLine(types2.join(" - "), left, 1922 + 26, right, 42);
      } else {
        let left = priceLine ? 730 + 65 * (numberPriceIcons - 1) : 701;
        let right = priceLine ? 800 - 65 * (numberPriceIcons - 1) : 900;
        writeSingleLine(typeLine, left, 1922, right, 64);
      }
      if (priceLine) writeLineWithIconsReplacedWithSpaces(priceLine + " ", 153, 1940, 85 / 90, "mySpecials"); //adding a space confuses writeLineWithIconsReplacedWithSpaces into thinking this isn't a line that needs resizing
      if (previewLine) {
        writeSingleLine((previewLine += " "), 223, 210, 0, 0, "mySpecials");
        writeSingleLine(previewLine, 1203, 210, 0, 0, "mySpecials");
      }
      context.fillStyle = isEachColorDark[0] ? "white" : "black";
      if (!heirloomLine) writeDescription("description", 701, 1520, 960, 660, 40);
      else writeDescription("description", 701, 1470, 960, 560, 40);
      writeIllustrationCredit(150, 2038, "white", "");
      writeCreatorCredit(1253, 2038, "white", "");

      drawExpansionIcon(1230, 1920, 80, 80);
    } else if (templateSize == 1) {
      //event/landscape
      drawPicture(1075, 584, 1887, 730);
      removeCorners(2151, 1403, 100);

      if (document.getElementById("trait").checked) {
        context.drawImage(getRecoloredImage(28, 0), 0, 0); //TraitColorOne
        if (heirloomLine) context.drawImage(images[14], 146, 832); //EventHeirloom

        context.drawImage(getRecoloredImage(29, 0, 6), 0, 0); //TraitUncoloredDetails
        context.drawImage(getRecoloredImage(15, 0, 9), 0, 0); //EventBar
        context.drawImage(getRecoloredImage(30, 0), 0, 0); //TraitColorSide
        context.drawImage(getRecoloredImage(31, 0, 6), 0, 0); //TraitUncoloredDetailsSide
        context.drawImage(getRecoloredImage(15, 0, 9), 0, 0); //EventBar
      } else {
        context.drawImage(getRecoloredImage(6, 0), 0, 0); //EventColorOne
        if (heirloomLine) context.drawImage(images[14], 146, 832); //EventHeirloom
        if (normalColorCurrentIndices[1] > 0)
          //two colors are different
          context.drawImage(getRecoloredImage(7, 1), 0, 0); //EventColorTwo
        context.drawImage(getRecoloredImage(8, 0, 6), 0, 0); //EventUncoloredDetails
        context.drawImage(getRecoloredImage(15, 0, 9), 0, 0); //EventBar
      }

      //no Traveller

      context.textAlign = "center";
      context.textBaseline = "middle";
      //context.font = "small-caps" + context.font;
      if (heirloomLine) writeSingleLine(heirloomLine, 1074, 900, 1600, 40, "myTitle");
      if (isEachColorDark[0]) context.fillStyle = "white";

      if (document.getElementById("trait").checked) {
        if (typeLine) {
          writeSingleLine(typeLine, 1075, 165, 780, 70);
        }

        context.save();
        context.rotate((Math.PI * 3) / 2);
        writeSingleLine(cardTitle, -700, 2030, 750, 70);
        context.restore();
        context.save();
        context.rotate(Math.PI / 2);
        writeSingleLine(cardTitle, 700, -120, 750, 70);
        context.restore();
      } else {
        writeSingleLine(cardTitle, 1075, 165, 780, 70);

        if (typeLine) {
          context.save();
          context.translate(1903, 240);
          context.rotate((45 * Math.PI) / 180);
          context.scale(1, 0.8); //yes, the letters are shorter
          writeSingleLine(typeLine, 0, 0, 283, 64);
          context.restore();
        }
      }

      if (priceLine) writeLineWithIconsReplacedWithSpaces(priceLine + " ", 130, 205, 85 / 90, "mySpecials"); //adding a space confuses writeLineWithIconsReplacedWithSpaces into thinking this isn't a line that needs resizing
      writeDescription("description", 1075, 1107, 1600, 283, 40);
      writeIllustrationCredit(181, 1272, "black", "bold ");
      writeCreatorCredit(1969, 1272, "black", "bold ");

      drawExpansionIcon(1930, 1190, 80, 80);
    } else if (templateSize == 2) {
      //double card
      drawPicture(704, 1075, 1150, 564);
      removeCorners(1403, 2151, 100);

      if (!recoloredImages[9]) recoloredImages[10] = false;
      context.drawImage(getRecoloredImage(9, 0), 0, 0); //DoubleColorOne
      if (!isEachColorDark[0]) context.drawImage(images[3], 44, 1330, images[3].width, (images[3].height * 2) / 3); //DescriptionFocus
      context.save();
      context.rotate(Math.PI);
      context.drawImage(getRecoloredImage(10, normalColorCurrentIndices[1] > 0 ? 1 : 0), -1403, -2151); //DoubleColorOne again, but rotated
      if (!isEachColorDark[1]) context.drawImage(images[3], 44 - 1403, 1330 - 2151, images[3].width, (images[3].height * 2) / 3); //DescriptionFocus
      context.restore();
      context.drawImage(images[11], 0, 0); //DoubleUncoloredDetails //todo

      function drawHalfCard(t, l, p, d, colorID) {
        context.textAlign = "center";
        context.textBaseline = "middle";
        //context.font = "small-caps" + context.font;
        //writeSingleLine(document.getElementById(l).value, 701, 215, 1180, 75);

        var recolorFactors;
        if (normalColorCurrentIndices[colorID] >= normalColorCustomIndices[colorID]) recolorFactors = recolorFactorList[colorID];
        else recolorFactors = normalColorFactorLists[normalColorCurrentIndices[colorID] - colorID][1];

        context.save();
        var title = document.getElementById(l).value;
        var size = 75 + 2;
        do {
          context.font = (size -= 2) + "pt myTitle";
        } while (context.measureText(title).width > 750);
        context.textAlign = "left";
        context.fillStyle = "rgb(" + Math.round(recolorFactors[0] * 224) + "," + Math.round(recolorFactors[1] * 224) + "," + Math.round(recolorFactors[2] * 224) + ")";
        context.lineWidth = 15;
        if (isEachColorDark[colorID]) context.strokeStyle = "white";
        context.strokeText(title, 150, 1287);
        context.fillText(title, 150, 1287);
        context.restore();

        if (isEachColorDark[colorID]) context.fillStyle = "white";
        writeSingleLine(t, p ? 750 : 701, 1922, p ? 890 : 1190, 64);
        if (p) writeLineWithIconsReplacedWithSpaces(p + " ", 153, 1940, 85 / 90, "mySpecials");
        writeDescription(d, 701, 1600, 960, 460, 40);
        context.restore();
      }
      context.save();
      drawHalfCard(typeLine, "title", priceLine, "description", 0);
      context.save();
      context.translate(1403, 2151); //bottom right corner
      context.rotate(Math.PI);
      shadowDistance = -shadowDistance;
      drawHalfCard(heirloomLine, "title2", previewLine, "description2", normalColorCurrentIndices[1] > 0 ? 1 : 0);
      shadowDistance = -shadowDistance;
      context.textAlign = "left";
      writeIllustrationCredit(150, 2038, "white", "");
      writeCreatorCredit(1253, 2038, "white", "");

      drawExpansionIcon(1230, 1920, 80, 80);
    } else if (templateSize == 3) {
      //base card
      drawPicture(704, 1075, 1150, 1898);
      removeCorners(1403, 2151, 100);

      context.drawImage(getRecoloredImage(20, 0), 0, 0); //CardColorOne
      context.drawImage(getRecoloredImage(21, 0, 6), 0, 0); //CardGray
      context.drawImage(getRecoloredImage(22, 0, 9), 0, 0); //CardBrown

      context.textAlign = "center";
      context.textBaseline = "middle";
      //context.font = "small-caps" + context.font;
      if (heirloomLine) {
        context.drawImage(images[13], 97, 1720); //Heirloom banner
        writeSingleLine(heirloomLine, 701, 1799, 1040, 40, "myTitle");
      }
      if (isEachColorDark[1]) context.fillStyle = "white";
      writeSingleLine(cardTitle, 701, 215, previewLine ? 800 : 1180, 75);
      if (typeLine.split(" - ").length >= 4) {
        let types2 = typeLine.split(" - ");
        let types1 = types2.splice(0, Math.ceil(types2.length / 2));
        writeSingleLine(types1.join(" - ") + " -", priceLine ? 750 : 701, 1945 - 26, priceLine ? 890 : 1180, 42);
        writeSingleLine(types2.join(" - "), priceLine ? 750 : 701, 1945 + 26, priceLine ? 890 : 1180, 42);
      } else {
        writeSingleLine(typeLine, priceLine ? 730 : 701, 1945, priceLine ? 800 : 900, 64);
      }
      if (priceLine) writeLineWithIconsReplacedWithSpaces(priceLine + " ", 153, 1947, 85 / 90, "mySpecials"); //adding a space confuses writeLineWithIconsReplacedWithSpaces into thinking this isn't a line that needs resizing
      if (previewLine) {
        writeSingleLine((previewLine += " "), 223, 210, 0, 0, "mySpecials");
        writeSingleLine(previewLine, 1203, 210, 0, 0, "mySpecials");
      }
      context.fillStyle = isEachColorDark[0] ? "white" : "black";
      // Skip description for official base cards (check expansion name and title)
      const expansionName = document.getElementById("expansionName").value.trim();
      // const isOfficialBaseCard = OfficialBaseCards[expansionName]?.includes(cardTitle.trim());
      // if (!isOfficialBaseCard) {
      if (!heirloomLine) writeDescription("description", 701, 1060, 960, 1500, 40);
      else writeDescription("description", 701, 1000, 960, 1400, 40);
      // }
      writeIllustrationCredit(165, 2045, "white", "");
      writeCreatorCredit(1225, 2045, "white", "");

      drawExpansionIcon(1230, 1945, 80, 80);
    } else if (templateSize == 4) {
      //pile marker
      drawPicture(1075, 702, 1250, 870);
      removeCorners(2151, 1403, 100);

      context.drawImage(getRecoloredImage(24, 0, 6), 0, 0); //CardGray
      context.drawImage(getRecoloredImage(23, 0), 0, 0); //CardColorOne

      context.textAlign = "center";
      context.textBaseline = "middle";

      context.save();
      if (isEachColorDark[1]) context.fillStyle = "white";
      context.rotate(Math.PI / 2);
      writeSingleLine(cardTitle, 700, -1920, 500, 75);
      context.restore();
      context.save();
      if (isEachColorDark[1]) context.fillStyle = "white";
      context.rotate((Math.PI * 3) / 2);
      writeSingleLine(cardTitle, -700, 230, 500, 75);
      context.restore();
    } else if (templateSize == 5) {
      //player mat
      drawPicture(464, 342, 928, 684);

      context.drawImage(getRecoloredImage(25, 0, 6), 0, 0); //MatBannerTop
      if (document.getElementById("description").value.trim().length > 0) context.drawImage(getRecoloredImage(26, 0, 6), 0, 0); //MatBannerBottom

      context.textAlign = "center";
      context.textBaseline = "middle";

      if (isEachColorDark[1]) context.fillStyle = "white";
      writeSingleLine(cardTitle, 464, 96, 490, 55);

      writeDescription("description", 464, 572, 700, 80, 40);

      writeIllustrationCredit(15, 660, "white", "", 16);
      writeCreatorCredit(913, 660, "white", "", 16);

      drawExpansionIcon(888, 40, 40, 40);
    }

    //finish up
    //context.restore();

    updateURL();

    document.getElementById("load-indicator").setAttribute("style", "display:none;");
    canvases[0].parentNode.removeAttribute("data-status");
    return;
  }
  var nextDrawInstruction = 0;

  function queueDraw(time) {
    if (nextDrawInstruction) window.clearTimeout(nextDrawInstruction);
    nextDrawInstruction = window.setTimeout(draw, time || 1500);
  }

  function switchColors() {
    var col1 = document.getElementById("normalcolor1").options.selectedIndex;
    var col2 = document.getElementById("normalcolor2").options.selectedIndex;
    if (col2 > 0) {
      let col1_copy = copy(col1);
      normalColorCurrentIndices[0] = document.getElementById("normalcolor1").options.selectedIndex = col2 - 1;
      normalColorCurrentIndices[1] = document.getElementById("normalcolor2").options.selectedIndex = col1_copy + 1;
      recoloredImages = [];
      queueDraw(1);
    }
  }

  function updateURL() {
    var queries = "?";
    for (var i = 0; i < simpleOnChangeInputFieldIDs.length; ++i) {
      if (simpleOnChangeInputCheckboxIDs.includes(simpleOnChangeInputFieldIDs[i])) {
        queries += simpleOnChangeInputFieldIDs[i] + "=" + encodeURIComponent(document.getElementById(simpleOnChangeInputFieldIDs[i]).checked) + "&";
      } else {
        queries += simpleOnChangeInputFieldIDs[i] + "=" + encodeURIComponent(document.getElementById(simpleOnChangeInputFieldIDs[i]).value) + "&";
      }
      if (templateSize == 2 && i < simpleOnChangeButOnlyForSize2InputFieldIDs.length)
        queries += simpleOnChangeButOnlyForSize2InputFieldIDs[i] + "=" + encodeURIComponent(document.getElementById(simpleOnChangeButOnlyForSize2InputFieldIDs[i]).value) + "&";
    }
    queries += "picture=" + encodeURIComponent(document.getElementById("picture").value) + "&";
    queries += "expansion=" + encodeURIComponent(document.getElementById("expansion").value) + "&";
    queries += "custom-icon=" + encodeURIComponent(document.getElementById("custom-icon").value);
    for (var i = 0; i < normalColorDropdowns.length; ++i) {
      switch (normalColorCustomIndices[i] - normalColorDropdowns[i].selectedIndex) {
        case 0: //custom
          for (var ch = 0; ch < 3; ++ch) queries += "&c" + i + "." + ch + "=" + recolorInputs[i * 12 + ch].value;
          break;
        case -1: //extra custom
          for (var ch = 0; ch < 12; ++ch) {
            var recolorInputsIndex = i * 12 + ch;
            if (recolorInputs.length <= recolorInputsIndex) break;
            queries += "&c" + i + "." + ((ch / 3) | 0) + "." + (ch % 3) + "=" + recolorInputs[i * 12 + ch].value;
          }
          break;
        default: //preconfigured
          queries += "&color" + i + "=" + normalColorDropdowns[i].selectedIndex;
          break;
      }
    }
    queries += "&size=" + templateSize;
    history.replaceState({}, "Dominion Card Image Generator", queries);
  }

  // help function to load images CORS save // https://stackoverflow.com/a/43001137
  function loadImgAsBase64(url, callback, maxWidth, maxHeight) {
    let canvas = document.createElement("CANVAS");
    let img = document.createElement("img");
    img.crossOrigin = "Anonymous";
    if (url.substr(0, 11) != "data:image/" && url.substr(0, 8) != "file:///") {
      img.src = CORS_ANYWHERE_BASE_URL + url;
    } else {
      img.src = url;
    }
    img.onload = () => {
      let context = canvas.getContext("2d");
      if (maxWidth > 0 && maxHeight > 0) {
        canvas.width = maxWidth;
        canvas.height = maxHeight;
      } else {
        canvas.height = img.height;
        canvas.width = img.width;
      }
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      let dataURL = canvas.toDataURL("image/png");
      canvas = null;
      callback(dataURL);
    };
    img.onerror = () => {
      useCORS = false;
      console.log("CORS loading of external resources deactivated");
      callback(url);
    };
  }

  // initialize stage
  var sources = [
    "CardColorOne.png",
    "CardColorTwo.png",
    "CardGray.png",
    "DescriptionFocus.png",
    "Traveller.png",
    "", //illustration //5
    "EventColorOne.png",
    "EventColorTwo.png",
    "EventBrown.png",
    "DoubleColorOne.png",
    "DoubleColorOne.png", //10
    "DoubleUncoloredDetails.png",
    "CardColorTwoNight.png",
    "Heirloom.png",
    "EventHeirloom.png",
    "EventBrown2.png", //15
    "CardBrown.png",
    "", //expansion
    "CardColorTwoSmall.png",
    "CardColorTwoBig.png",
    "BaseCardColorOne.png", //20
    "BaseCardGray.png",
    "BaseCardBrown.png",
    "PileMarkerColorOne.png",
    "PileMarkerGrey.png",
    "MatBannerTop.png", //25
    "MatBannerBottom.png",
    "CardColorThree.png",
    "TraitColorOne.png",
    "TraitBrown.png",
    "TraitColorOneSide.png", //30
    "TraitBrownSide.png",
    //icons come afterwards
  ];
  for (var i = 0; i < sources.length; i++) recoloredImages.push(false);
  var legend = document.getElementById("legend");
  var numberFirstIcon = sources.length;
  for (key in icons) {
    var li = document.createElement("li");
    li.textContent = ": " + icons[key][3];
    var span = document.createElement("span");
    span.classList.add("def");
    span.textContent = key.replace("\\", "");
    li.insertBefore(span, li.firstChild);
    legend.insertBefore(li, legend.firstChild);
    if (icons[key][0] === "Custom Icon") {
      continue;
    }
    sources.push(icons[key][0] + ".png");
  }
  for (var i = 0; i < sources.length; i++) {
    images.push(new Image());
    images[i].crossOrigin = "Anonymous";
    // Empty sources (illustration, expansion) get data URL placeholder so they're immediately complete
    if (sources[i]) {
      images[i].src = "card-resources/" + sources[i];
    } else {
      images[i].src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    }
  }
  // Add placeholder for Custom Icon (so images.length - 1 refers to it)
  // Use empty data URL so the image is considered "complete"
  var customIconPlaceholder = new Image();
  customIconPlaceholder.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  images.push(customIconPlaceholder);

  var simpleOnChangeInputCheckboxIDs = ["traveller", "trait"];
  var simpleOnInputInputFieldIDs = [
    "title",
    "description",
    "credit",
    "creator",
    "price",
    "preview",
    "type",
    "type2",
    "picture-x",
    "picture-y",
    "picture-zoom",
    "descriptionFontSize",
    "color2split",
    "boldkeys",
    "deckSize",
  ];
  var simpleOnChangeInputFieldIDs = ["expansionName"];
  simpleOnChangeInputFieldIDs = simpleOnChangeInputFieldIDs.concat(simpleOnInputInputFieldIDs, simpleOnChangeInputCheckboxIDs);
  var simpleOnChangeButOnlyForSize2InputFieldIDs = ["title2", "description2"];
  for (var i = 0; i < simpleOnChangeInputFieldIDs.length; ++i) {
    document.getElementById(simpleOnChangeInputFieldIDs[i]).onchange = queueDraw;
    if (simpleOnInputInputFieldIDs.includes(simpleOnChangeInputFieldIDs[i])) {
      document.getElementById(simpleOnChangeInputFieldIDs[i]).oninput = queueDraw;
    }
    if (i < simpleOnChangeButOnlyForSize2InputFieldIDs.length) document.getElementById(simpleOnChangeButOnlyForSize2InputFieldIDs[i]).onchange = queueDraw;
  }
  var recolorInputs = document.getElementsByName("recolor");
  var alreadyNeededToDetermineCustomAccentColors = false;
  for (var i = 0; i < recolorInputs.length; ++i)
    recolorInputs[i].oninput = (function (i) {
      return function () {
        var val = parseFloat(this.value);
        if (val !== NaN) {
          var imageID = Math.floor(i / 12);
          if (normalColorCurrentIndices[imageID] >= 10) {
            //potentially recoloring the supposedly Uncolored images
            recoloredImages[2] = false;
            recoloredImages[8] = false;
            recoloredImages[11] = false;
            recoloredImages[15] = false;
            recoloredImages[16] = false;
            recoloredImages[29] = false;
            recoloredImages[31] = false;
          }
          recoloredImages[imageID] = false;
          recoloredImages[imageID + 6] = false;
          recoloredImages[imageID + 9] = false;
          recoloredImages[12] = false;
          recoloredImages[18] = false;
          recoloredImages[19] = false;
          recoloredImages[20] = false;
          recoloredImages[23] = false;
          recoloredImages[28] = false;
          recoloredImages[30] = false;
          recolorFactorList[imageID][i % 12] = val;
          queueDraw();
        }
      };
    })(i);

  function setImageSource(id, src) {
    images[id].src = src;
    images[id].crossOrigin = "Anonymous";
    imagesLoaded = false;
    queueDraw(250);
  }

  function onChangeExternalImage(id, value, maxWidth, maxHeight) {
    let url = (sources[id] = value.trim());

    // Skip processing for special iframe placeholder value
    if (url === "[iframe]") {
      return;
    }

    if (url != "[local image]") {
      if (typeof myFavorites !== "undefined") {
        myFavorites.getDB().deleteLiveImage(id);
      }
      if (url.length > 0) {
        // Data URLs can be used directly
        if (url.startsWith("data:")) {
          setImageSource(id, url);
        } else if (useCORS) {
          loadImgAsBase64(
            url,
            (dataURL) => {
              setImageSource(id, dataURL);
            },
            maxWidth,
            maxHeight,
          );
        } else {
          setImageSource(id, url);
        }
      } else {
        // Clear image when URL is empty
        // Use empty data URL so the image is considered "complete"
        images[id] = new Image();
        images[id].src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        imagesLoaded = false;
        queueDraw(250);
      }
    }
  }

  async function onUploadImage(id, file) {
    var reader = new FileReader();
    reader.onload = async () => {
      setImageSource(id, reader.result);
      try {
        await myFavorites.getDB().saveLiveImage(id, reader.result);
      } catch (e) {
        console.error("Failed to save image to IndexedDB:", e);
      }
      console.log("image loaded");
    };
    reader.readAsDataURL(file);
  }

  if (document.getElementById("trait").checked) {
    document.body.classList.add("trait");
  }

  document.getElementById("trait").addEventListener(
    "change",
    () => {
      if (document.getElementById("trait").checked) {
        document.body.classList.add("trait");
      } else {
        document.body.classList.remove("trait");
      }
    },
    false,
  );

  try {
    // Image 5 = Main Picture
    document.getElementById("picture").onchange = function () {
      document.getElementById("picture-upload").value = "";
      onChangeExternalImage(5, this.value);
    };
    document.getElementById("picture-upload").onchange = (event) => {
      document.getElementById("picture").value = "[local image]";
      onUploadImage(5, event.target.files[0]);
    };
  } catch (err) {}

  try {
    // Image 17 = Expansion Icon
    document.getElementById("expansion").onchange = function () {
      document.getElementById("expansion-upload").value = "";
      onChangeExternalImage(17, this.value);
    };
    document.getElementById("expansion-upload").onchange = (event) => {
      document.getElementById("expansion").value = "[local image]";
      onUploadImage(17, event.target.files[0]);
    };
  } catch (err) {}

  try {
    //Last Icon = Custom Icon
    var customIcon = document.getElementById("custom-icon");
    onChangeExternalImage(images.length - 1, customIcon.value, 156, 156);
    customIcon.onchange = function () {
      document.getElementById("custom-icon-upload").value = "";
      onChangeExternalImage(images.length - 1, this.value, 156, 156);
    };
    document.getElementById("custom-icon-upload").onchange = (event) => {
      customIcon.value = "[local image]";
      onUploadImage(images.length - 1, event.target.files[0]);
    };
  } catch (err) {}

  var genericCustomAccentColors = [
    [0, 0, 0, 0, 0, 0, 1, 1, 1, 1.2, 0.8, 0.5],
    [0, 0, 0, 0, 0, 0, 0.9, 0.8, 0.7, 0.9, 0.8, 0.7],
  ];
  for (i = 0; i < normalColorDropdowns.length; ++i)
    normalColorDropdowns[i].onchange = (function (i) {
      return function () {
        if (normalColorCurrentIndices[i] >= 10 || this.selectedIndex >= 10) {
          //potentially recoloring the supposedly Uncolored images
          recoloredImages[2] = false;
          recoloredImages[8] = false;
          recoloredImages[11] = false;
          recoloredImages[15] = false;
          recoloredImages[16] = false;
          recoloredImages[29] = false;
          recoloredImages[31] = false;
        }
        normalColorCurrentIndices[i] = this.selectedIndex;
        recoloredImages[i] = false;
        recoloredImages[i + 6] = false;
        recoloredImages[i + 9] = false;
        recoloredImages[2] = false;
        recoloredImages[12] = false;
        recoloredImages[18] = false;
        recoloredImages[19] = false;
        recoloredImages[20] = false;
        recoloredImages[23] = false;
        recoloredImages[28] = false;
        recoloredImages[30] = false;
        var delta = normalColorCustomIndices[i] - this.selectedIndex;
        if (delta <= 0) this.nextElementSibling.removeAttribute("style");
        else this.nextElementSibling.setAttribute("style", "display:none;");
        if (delta === -1) {
          this.nextElementSibling.nextElementSibling.removeAttribute("style");
          if (i === 0 && !alreadyNeededToDetermineCustomAccentColors) {
            alreadyNeededToDetermineCustomAccentColors = true;
            for (var j = 6; j < 12; ++j) recolorFactorList[0][j] = recolorInputs[j].value = genericCustomAccentColors[templateSize & 1][j];
          }
        } else this.nextElementSibling.nextElementSibling.setAttribute("style", "display:none;");
        queueDraw(1);
      };
    })(i);
  // Update deck size placeholder based on card size
  function updateDeckSizePlaceholder() {
    let placeholder;
    if (templateSize === 4 || templateSize === 5) {
      placeholder = String(DEFAULT_DECK_SIZE_SINGLE);
    } else if (templateSize === 1) {
      placeholder = String(DEFAULT_DECK_SIZE_LANDSCAPE);
    } else {
      placeholder = String(DEFAULT_DECK_SIZE);
    }
    const deckSizeInput = document.getElementById("deckSize");
    const deckSizeModalInput = document.getElementById("type-edit-decksize");
    if (deckSizeInput) deckSizeInput.placeholder = placeholder;
    if (deckSizeModalInput) deckSizeModalInput.placeholder = placeholder;
  }

  var templateSizeInputs = document.getElementsByName("size");
  for (var i = 0; i < templateSizeInputs.length; ++i)
    templateSizeInputs[i].onchange = (function (i) {
      return function () {
        templateSize = parseInt(this.value);
        document.body.className = this.id;
        if (document.getElementById("trait").checked) {
          document.body.classList.add("trait");
        }
        updateDeckSizePlaceholder();
        document.getElementById("load-indicator").removeAttribute("style");
        canvases[0].parentNode.setAttribute("data-status", "Loading...");
        queueDraw(250);
      };
    })(i);

  //ready to begin: load information from query parameters
  var query = getQueryParams(document.location.search);
  document.body.className = "";
  for (var queryKey in query) {
    switch (queryKey) {
      case "color0":
        normalColorCurrentIndices[0] = normalColorDropdowns[0].selectedIndex = parseInt(query[queryKey]) || 0;
        break;
      case "color1":
        normalColorCurrentIndices[1] = normalColorDropdowns[1].selectedIndex = parseInt(query[queryKey]) || 0;
        break;
      case "size":
        var buttonElement = document.getElementsByName("size")[(templateSize = parseInt(query[queryKey]))];
        document.body.classList.add(buttonElement.id);
        buttonElement.checked = true;
        break;
      case "traveller":
        var checkboxElement = document.getElementById(queryKey);
        checkboxElement.checked = query[queryKey] === "true";
        break;
      case "trait":
        var checkboxElement = document.getElementById(queryKey);
        checkboxElement.checked = query[queryKey] === "true";
        if (checkboxElement.checked === true) {
          document.body.classList.add(queryKey);
        }
        break;
      default:
        var matches = queryKey.match(/^c(\d)\.(\d)$/);
        if (matches) {
          var id = matches[1];
          normalColorCurrentIndices[id] = normalColorDropdowns[id].selectedIndex = normalColorCustomIndices[id];
          normalColorDropdowns[id].nextElementSibling.removeAttribute("style");
          recolorFactorList[id][matches[2]] = recolorInputs[12 * id + parseInt(matches[2])].value = parseFloat(query[queryKey]);
        } else {
          matches = queryKey.match(/^c(\d)\.(\d)\.(\d)$/);
          if (matches) {
            alreadyNeededToDetermineCustomAccentColors = true;
            var id = matches[1];
            normalColorCurrentIndices[id] = normalColorDropdowns[id].selectedIndex = normalColorCustomIndices[id] + 1;
            normalColorDropdowns[id].nextElementSibling.removeAttribute("style");
            normalColorDropdowns[id].nextElementSibling.nextElementSibling.removeAttribute("style");
            recolorFactorList[id][parseInt(matches[2]) * 3 + parseInt(matches[3])] = recolorInputs[12 * id + 3 * parseInt(matches[2]) + parseInt(matches[3])].value = parseFloat(query[queryKey]);
          } else {
            var el = document.getElementById(queryKey);
            if (el) el.value = query[queryKey];
          }
        }
        break;
    }
    for (var i = 0; i < simpleOnChangeButOnlyForSize2InputFieldIDs.length; ++i)
      if (!document.getElementById(simpleOnChangeButOnlyForSize2InputFieldIDs[i]).value)
        document.getElementById(simpleOnChangeButOnlyForSize2InputFieldIDs[i]).value = document.getElementById(
          simpleOnChangeButOnlyForSize2InputFieldIDs[i].substr(0, simpleOnChangeButOnlyForSize2InputFieldIDs[i].length - 1),
        ).value;
  }
  //set the illustration's Source properly and also call queueDraw.
  const handleLocalImageRestore = async (fieldId, imageId, db) => {
    const el = document.getElementById(fieldId);
    if (el && el.value === "[local image]") {
      const database = db || myFavorites.getDB();
      try {
        const storedData = await database.getLiveImage(imageId);
        if (storedData) {
          setImageSource(imageId, storedData);
        } else {
          console.warn(`Local image not found in IndexedDB for ${fieldId}`);
          el.value = "";
          if (el.onchange) {
            el.onchange();
          }
        }
      } catch (e) {
        console.error(`Failed to load local image from IndexedDB for ${fieldId}:`, e);
        el.value = "";
        if (el.onchange) {
          el.onchange();
        }
      }
    } else if (el && el.onchange) {
      el.onchange();
    }
  };

  const db = new CardDatabase();
  db.init().then(async () => {
    await handleLocalImageRestore("picture", 5, db);
    await handleLocalImageRestore("expansion", 17, db);
    await handleLocalImageRestore("custom-icon", images.length - 1, db);
  });

  //adjust page title
  function adjustPageTitle() {
    let cardTitle = document.getElementById("title").value.trim();
    let creator = document.getElementById("creator").value.trim();
    let pageDefaultTitle = "Dominion Card Image Generator";
    document.title = cardTitle.length > 0 ? pageDefaultTitle + " - " + cardTitle + " " + creator : pageDefaultTitle;
  }
  document.getElementById("title").addEventListener("change", adjustPageTitle, false);
  document.getElementById("creator").addEventListener("change", adjustPageTitle, false);
  adjustPageTitle();

  //redraw after color switch
  document.getElementById("color-switch-button").addEventListener("click", switchColors, false);

  //pass parameters to original version to enable easy comparison
  Array.from(document.getElementsByClassName("linkToOriginal")).forEach((el) =>
    el.addEventListener(
      "click",
      function (event) {
        event.preventDefault();
        window.open(this.href + document.location.search);
      },
      false,
    ),
  );

  // Expose functions for PDF export
  window.images = images;

  window.triggerRedraw = function () {
    queueDraw(1);
  };

  window.setImageSourceForExport = function (id, src) {
    images[id].src = src || "";
    if (src) {
      images[id].crossOrigin = "Anonymous";
    }
    imagesLoaded = false;
  };

  window.setImageSource = function (id, src) {
    images[id].src = src;
    images[id].crossOrigin = "Anonymous";
    imagesLoaded = false;
    queueDraw(250);
  };

  window.clearImageSource = function (id) {
    images[id] = new Image();
    images[id].src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    imagesLoaded = false;
    queueDraw(250);
  };

  window.onUploadImage = function (id, file) {
    onUploadImage(id, file);
  };

  window.onChangeExternalImage = function (id, value, maxWidth, maxHeight) {
    onChangeExternalImage(id, value, maxWidth, maxHeight);
  };

  window.showLoadingState = function () {
    const wrapper = canvases[0].parentNode;
    wrapper.setAttribute("data-status", "Loading...");
    // Show spinner
    document.getElementById("load-indicator").removeAttribute("style");
    // Clear all canvases
    for (let i = 0; i < canvases.length; i++) {
      const ctx = canvases[i].getContext("2d");
      ctx.clearRect(0, 0, canvases[i].width, canvases[i].height);
    }
  };

  window.applyQueryParams = function (queryString) {
    const query = getQueryParams(queryString);
    document.body.className = "";

    // Reset fields not present in query params
    const fieldsToReset = [
      "title",
      "description",
      "credit",
      "creator",
      "price",
      "preview",
      "type",
      "type2",
      "picture-x",
      "picture-y",
      "picture-zoom",
      "boldkeys",
      "deckSize",
      "expansionName",
      "title2",
      "description2",
      "picture",
      "expansion",
      "custom-icon",
    ];
    const imageFields = ["picture", "expansion", "custom-icon"];
    for (const fieldId of fieldsToReset) {
      if (!(fieldId in query)) {
        const el = document.getElementById(fieldId);
        if (el) {
          if (fieldId === "picture-zoom") {
            el.value = "1";
          } else if (fieldId === "picture-x" || fieldId === "picture-y") {
            el.value = "0";
          } else {
            el.value = "";
          }
          // Trigger change event for image fields to clear images
          if (imageFields.includes(fieldId)) {
            el.dispatchEvent(new Event("change"));
          }
        }
      }
    }

    for (var queryKey in query) {
      switch (queryKey) {
        case "color0":
          normalColorCurrentIndices[0] = normalColorDropdowns[0].selectedIndex = parseInt(query[queryKey]) || 0;
          break;
        case "color1":
          normalColorCurrentIndices[1] = normalColorDropdowns[1].selectedIndex = parseInt(query[queryKey]) || 0;
          break;
        case "size":
          var buttonElement = document.getElementsByName("size")[(templateSize = parseInt(query[queryKey]))];
          document.body.classList.add(buttonElement.id);
          buttonElement.checked = true;
          break;
        case "traveller":
          var checkboxElement = document.getElementById(queryKey);
          checkboxElement.checked = query[queryKey] === "true";
          break;
        case "trait":
          var checkboxElement = document.getElementById(queryKey);
          checkboxElement.checked = query[queryKey] === "true";
          if (checkboxElement.checked === true) {
            document.body.classList.add(queryKey);
          }
          break;
        default:
          var matches = queryKey.match(/^c(\d)\.(\d)$/);
          if (matches) {
            var id = matches[1];
            normalColorCurrentIndices[id] = normalColorDropdowns[id].selectedIndex = normalColorCustomIndices[id];
            normalColorDropdowns[id].nextElementSibling.removeAttribute("style");
            recolorFactorList[id][matches[2]] = recolorInputs[12 * id + parseInt(matches[2])].value = parseFloat(query[queryKey]);
          } else {
            matches = queryKey.match(/^c(\d)\.(\d)\.(\d)$/);
            if (matches) {
              var id = matches[1];
              normalColorCurrentIndices[id] = normalColorDropdowns[id].selectedIndex = normalColorCustomIndices[id] + 1;
              normalColorDropdowns[id].nextElementSibling.removeAttribute("style");
              normalColorDropdowns[id].nextElementSibling.nextElementSibling.removeAttribute("style");
              recolorFactorList[id][parseInt(matches[2]) * 3 + parseInt(matches[3])] = recolorInputs[12 * id + 3 * parseInt(matches[2]) + parseInt(matches[3])].value = parseFloat(query[queryKey]);
            } else {
              var el = document.getElementById(queryKey);
              if (el) el.value = query[queryKey];
            }
          }
          break;
      }
    }

    // Set default size if not specified
    if (!("size" in query)) {
      templateSize = 0;
      document.body.classList.add("size0");
      document.getElementById("size0").checked = true;
    }

    // Set default colors if not specified
    if (!("color0" in query)) {
      normalColorCurrentIndices[0] = normalColorDropdowns[0].selectedIndex = 0;
    }
    if (!("color1" in query)) {
      normalColorCurrentIndices[1] = normalColorDropdowns[1].selectedIndex = 0;
    }

    recoloredImages = [];
    imagesLoaded = false;
    queueDraw(1);

    // Update deck size placeholder based on size
    updateDeckSizePlaceholder();

    // Update tap overlay states after form values are set
    if (typeof updateTapOverlayStates === "function") {
      updateTapOverlayStates();
    }
  };

  // Update tap overlay states after initial query params are processed
  if (typeof updateTapOverlayStates === "function") {
    updateTapOverlayStates();
  }
}

function getQueryParams(qs) {
  //http://stackoverflow.com/questions/979975/how-to-get-the-value-from-the-get-parameters
  if (!qs) return {};
  qs = qs.split("+").join(" ");

  var params = {},
    tokens,
    re = /[?&]?([^&=]+)=?([^&]*)/g;

  while ((tokens = re.exec(qs))) {
    params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
  }

  return params;
}

// Scroll lock helpers for mobile modals
let savedScrollPosition = 0;

function lockScroll() {
  savedScrollPosition = window.scrollY;
  document.body.style.top = `-${savedScrollPosition}px`;
  document.body.classList.add("no-scroll");
}

function unlockScroll() {
  document.body.classList.remove("no-scroll");
  document.body.style.top = "";
  window.scrollTo(0, savedScrollPosition);
}

// Close modal with animation helper
function closeModalWithAnimation(modal, callback) {
  if (window.innerWidth <= 600) {
    modal.classList.add("closing");
    modal.addEventListener(
      "animationend",
      () => {
        modal.classList.remove("closing");
        modal.classList.add("hidden");
        unlockScroll();
        if (callback) callback();
      },
      { once: true },
    );
  } else {
    modal.classList.add("hidden");
    unlockScroll();
    if (callback) callback();
  }
}

// Open modal with animation helper (resets animation for re-triggering)
function openModalWithAnimation(modal) {
  if (window.innerWidth <= 600) {
    // Force animation restart by temporarily adding a class
    modal.classList.add("no-animate");
    modal.offsetHeight; // Trigger reflow
    modal.classList.remove("no-animate");
  }
  modal.classList.remove("hidden");
  lockScroll();
  document.activeElement.blur();
}

// Search help popup toggle
function toggleSearchHelp() {
  const popup = document.getElementById("search-help-popup");
  const btn = document.getElementById("search-help-toggle");
  if (popup.classList.contains("hidden")) {
    popup.classList.remove("hidden");
    btn.classList.add("active");
  } else {
    popup.classList.add("hidden");
    btn.classList.remove("active");
  }
}

// Text Edit Modal for mobile
let textEditPendingCustomIconFile = null;

function toggleTextEditLegend() {
  const legendContainer = document.getElementById("text-edit-legend");
  if (!legendContainer) return;

  if (legendContainer.classList.contains("hidden")) {
    // Show
    legendContainer.classList.remove("hidden", "closing");
  } else {
    // Hide with animation
    legendContainer.classList.add("closing");
    legendContainer.addEventListener(
      "animationend",
      () => {
        legendContainer.classList.add("hidden");
        legendContainer.classList.remove("closing");
      },
      { once: true },
    );
  }
}

function openTextEditModal() {
  const modal = document.getElementById("text-edit-modal");
  const textarea = document.getElementById("text-edit-textarea");
  const descriptionField = document.getElementById("description");
  const legendContainer = document.getElementById("text-edit-legend");
  const boldkeysInput = document.getElementById("text-edit-boldkeys");
  const customIconInput = document.getElementById("text-edit-custom-icon");
  const customIconUpload = document.getElementById("text-edit-custom-icon-upload");

  // Clone legend if not already done
  if (!legendContainer.hasChildNodes()) {
    const legend = document.getElementById("legend");
    legendContainer.appendChild(legend.cloneNode(true));
    legendContainer.firstChild.removeAttribute("id");
  }

  // Reset pending file
  textEditPendingCustomIconFile = null;
  customIconUpload.value = "";

  // Sync values from main form
  textarea.value = descriptionField.value;
  boldkeysInput.value = document.getElementById("boldkeys").value;
  customIconInput.value = document.getElementById("custom-icon").value;

  openModalWithAnimation(modal);
}

function closeTextEditModal(apply) {
  const modal = document.getElementById("text-edit-modal");
  const textarea = document.getElementById("text-edit-textarea");
  const descriptionField = document.getElementById("description");
  const boldkeysInput = document.getElementById("text-edit-boldkeys");
  const customIconInput = document.getElementById("text-edit-custom-icon");

  if (apply) {
    descriptionField.value = textarea.value;
    descriptionField.dispatchEvent(new Event("input"));

    document.getElementById("boldkeys").value = boldkeysInput.value;
    document.getElementById("boldkeys").dispatchEvent(new Event("change"));

    // Handle custom icon - either uploaded file or URL
    if (textEditPendingCustomIconFile) {
      document.getElementById("custom-icon").value = "[local image]";
      window.onUploadImage(images.length - 1, textEditPendingCustomIconFile);
    } else if (customIconInput.value !== document.getElementById("custom-icon").value) {
      document.getElementById("custom-icon").value = customIconInput.value;
      document.getElementById("custom-icon").dispatchEvent(new Event("change"));
    }
  }

  textEditPendingCustomIconFile = null;

  // Hide legend if visible
  const legendContainer = document.getElementById("text-edit-legend");
  if (legendContainer && !legendContainer.classList.contains("hidden")) {
    legendContainer.classList.add("hidden");
    legendContainer.classList.remove("closing");
  }

  closeModalWithAnimation(modal);
}

// Picture Edit Modal for mobile
let pictureEditPendingFile = null;

function openPictureEditModal() {
  const modal = document.getElementById("picture-edit-modal");
  const urlInput = document.getElementById("picture-edit-url");
  const xInput = document.getElementById("picture-edit-x");
  const yInput = document.getElementById("picture-edit-y");
  const zoomInput = document.getElementById("picture-edit-zoom");
  const uploadInput = document.getElementById("picture-edit-upload");

  // Reset pending file and upload input
  pictureEditPendingFile = null;
  uploadInput.value = "";

  // Sync values from main form
  urlInput.value = document.getElementById("picture").value;
  xInput.value = document.getElementById("picture-x").value;
  yInput.value = document.getElementById("picture-y").value;
  zoomInput.value = document.getElementById("picture-zoom").value;

  // Sync sliders
  document.getElementById("picture-edit-x-slider").value = xInput.value;
  document.getElementById("picture-edit-y-slider").value = yInput.value;
  document.getElementById("picture-edit-zoom-slider").value = zoomInput.value;

  openModalWithAnimation(modal);
}

function closePictureEditModal(apply) {
  const modal = document.getElementById("picture-edit-modal");

  if (apply) {
    const urlInput = document.getElementById("picture-edit-url");
    const xInput = document.getElementById("picture-edit-x");
    const yInput = document.getElementById("picture-edit-y");
    const zoomInput = document.getElementById("picture-edit-zoom");

    // Handle picture - either uploaded file or URL
    if (pictureEditPendingFile) {
      document.getElementById("picture").value = "[local image]";
      document.getElementById("picture-upload").value = "";
      window.onUploadImage(5, pictureEditPendingFile);
    } else if (urlInput.value !== document.getElementById("picture").value) {
      const pictureEl = document.getElementById("picture");
      pictureEl.value = urlInput.value;
      pictureEl.dispatchEvent(new Event("change"));
    }

    document.getElementById("picture-x").value = xInput.value;
    document.getElementById("picture-y").value = yInput.value;
    document.getElementById("picture-zoom").value = zoomInput.value;
    document.getElementById("picture-zoom").dispatchEvent(new Event("change"));
  }

  pictureEditPendingFile = null;
  closeModalWithAnimation(modal);
}

function resetPictureEditPosition() {
  document.getElementById("picture-edit-x").value = 0;
  document.getElementById("picture-edit-y").value = 0;
  document.getElementById("picture-edit-zoom").value = 1;
  // Reset mobile sliders
  document.getElementById("picture-edit-x-slider").value = 0;
  document.getElementById("picture-edit-y-slider").value = 0;
  document.getElementById("picture-edit-zoom-slider").value = 1;
  // Trigger real-time update
  document.getElementById("picture-x").value = 0;
  document.getElementById("picture-y").value = 0;
  document.getElementById("picture-zoom").value = 1;
  // Reset PC sliders
  const pcXSlider = document.getElementById("picture-x-slider");
  const pcYSlider = document.getElementById("picture-y-slider");
  const pcZoomSlider = document.getElementById("picture-zoom-slider");
  if (pcXSlider) pcXSlider.value = 0;
  if (pcYSlider) pcYSlider.value = 0;
  if (pcZoomSlider) pcZoomSlider.value = 1;
  document.getElementById("picture-zoom").dispatchEvent(new Event("change"));
}

// Type Edit Modal color switch for mobile
function switchTypeEditColors() {
  const color1Select = document.getElementById("type-edit-color1");
  const color2Select = document.getElementById("type-edit-color2");

  const color1Index = color1Select.selectedIndex;
  const color2Index = color2Select.selectedIndex;

  // Only swap if sub color is not "なし" (index 0)
  if (color2Index > 0) {
    // Swap in mobile modal (color2 has "なし" at index 0, so adjust indices)
    color1Select.selectedIndex = color2Index - 1;
    color2Select.selectedIndex = color1Index + 1;

    // Trigger change events to sync to main form
    color1Select.dispatchEvent(new Event("change"));
    color2Select.dispatchEvent(new Event("change"));
  }
}

// Type Edit Modal for mobile
function openTypeEditModal() {
  const modal = document.getElementById("type-edit-modal");
  const color1Select = document.getElementById("type-edit-color1");
  const color2Select = document.getElementById("type-edit-color2");
  const typeInput = document.getElementById("type-edit-type");
  const heirloomInput = document.getElementById("type-edit-heirloom");
  const deckSizeInput = document.getElementById("type-edit-decksize");
  const travellerCheckbox = document.getElementById("type-edit-traveller");
  const traitCheckbox = document.getElementById("type-edit-trait");
  const mainColor1Select = document.getElementById("normalcolor1");
  const mainColor2Select = document.getElementById("normalcolor2");
  const recolorInputs = document.getElementsByName("recolor");
  const customColorsGroup = modal.querySelector(".type-edit-custom-colors");
  const customColorsGroup2 = modal.querySelector(".type-edit-custom-colors2");
  const extraColorsElems = modal.querySelectorAll(".type-edit-extra-colors");
  const extraColorsElems2 = modal.querySelectorAll(".type-edit-extra-colors2");
  const splitSelector = modal.querySelector(".type-edit-split-selector");
  const splitSelect = document.getElementById("type-edit-split");
  const mainSplitSelect = document.getElementById("color2split");

  // Clone color options if not already done
  if (color1Select.options.length === 0) {
    for (let i = 0; i < mainColor1Select.options.length; i++) {
      const option = document.createElement("option");
      option.textContent = mainColor1Select.options[i].textContent;
      option.value = i;
      color1Select.appendChild(option);
    }
  }
  if (color2Select.options.length === 0) {
    for (let i = 0; i < mainColor2Select.options.length; i++) {
      const option = document.createElement("option");
      option.textContent = mainColor2Select.options[i].textContent;
      option.value = i;
      color2Select.appendChild(option);
    }
  }

  // Sync values from main form
  color1Select.selectedIndex = mainColor1Select.selectedIndex;
  color2Select.selectedIndex = mainColor2Select.selectedIndex;
  typeInput.value = document.getElementById("type").value;
  heirloomInput.value = document.getElementById("type2").value;
  deckSizeInput.value = document.getElementById("deckSize").value;
  travellerCheckbox.checked = document.getElementById("traveller").checked;
  traitCheckbox.checked = document.getElementById("trait").checked;
  splitSelect.value = mainSplitSelect.value;

  // Sync custom color values (12 values for color1, 12 for color2)
  for (let i = 0; i < 12; i++) {
    const modalInput1 = document.getElementById("type-edit-recolor" + i);
    const modalInput2 = document.getElementById("type-edit-recolor" + (i + 12));
    if (modalInput1 && recolorInputs[i]) {
      modalInput1.value = recolorInputs[i].value;
    }
    if (modalInput2 && recolorInputs[i + 12]) {
      modalInput2.value = recolorInputs[i + 12].value;
    }
  }

  // Show/hide custom color inputs based on selection
  const customIndex1 = mainColor1Select.options.length - 2; // カスタム index
  const extraCustomIndex1 = mainColor1Select.options.length - 1; // エクストラカスタム index
  const customIndex2 = mainColor2Select.options.length - 2;
  const extraCustomIndex2 = mainColor2Select.options.length - 1;

  function updateColorVisibility() {
    const isCustom1 = color1Select.selectedIndex >= customIndex1;
    const isExtraCustom1 = color1Select.selectedIndex >= extraCustomIndex1;
    const isCustom2 = color2Select.selectedIndex >= customIndex2;
    const isExtraCustom2 = color2Select.selectedIndex >= extraCustomIndex2;
    const hasColor2 = color2Select.selectedIndex > 0; // 0 is "なし"

    customColorsGroup.classList.toggle("hidden", !isCustom1);
    customColorsGroup2.classList.toggle("hidden", !isCustom2);
    extraColorsElems.forEach((el) => el.classList.toggle("hidden", !isExtraCustom1));
    extraColorsElems2.forEach((el) => el.classList.toggle("hidden", !isExtraCustom2));
    splitSelector.classList.toggle("hidden", !hasColor2);
  }

  updateColorVisibility();

  // Add change listeners to show/hide custom colors
  color1Select.onchange = updateColorVisibility;
  color2Select.onchange = updateColorVisibility;

  openModalWithAnimation(modal);
}

function closeTypeEditModal(apply) {
  const modal = document.getElementById("type-edit-modal");

  if (apply) {
    const color1Select = document.getElementById("type-edit-color1");
    const color2Select = document.getElementById("type-edit-color2");
    const typeInput = document.getElementById("type-edit-type");
    const heirloomInput = document.getElementById("type-edit-heirloom");
    const deckSizeInput = document.getElementById("type-edit-decksize");
    const travellerCheckbox = document.getElementById("type-edit-traveller");
    const traitCheckbox = document.getElementById("type-edit-trait");
    const mainColor1Select = document.getElementById("normalcolor1");
    const mainColor2Select = document.getElementById("normalcolor2");
    const recolorInputs = document.getElementsByName("recolor");

    // Apply colors if changed
    if (mainColor1Select.selectedIndex !== color1Select.selectedIndex) {
      mainColor1Select.selectedIndex = color1Select.selectedIndex;
      mainColor1Select.dispatchEvent(new Event("change"));
    }
    if (mainColor2Select.selectedIndex !== color2Select.selectedIndex) {
      mainColor2Select.selectedIndex = color2Select.selectedIndex;
      mainColor2Select.dispatchEvent(new Event("change"));
    }

    // Apply custom color values if custom color is selected
    const customIndex1 = mainColor1Select.options.length - 2;
    const extraCustomIndex1 = mainColor1Select.options.length - 1;
    const customIndex2 = mainColor2Select.options.length - 2;
    const extraCustomIndex2 = mainColor2Select.options.length - 1;

    // Color 1: Apply card color (0-2), and extra colors (3-11) if extra custom
    if (color1Select.selectedIndex >= customIndex1) {
      const maxIndex = color1Select.selectedIndex >= extraCustomIndex1 ? 12 : 3;
      for (let i = 0; i < maxIndex; i++) {
        const modalInput = document.getElementById("type-edit-recolor" + i);
        if (modalInput && recolorInputs[i]) {
          recolorInputs[i].value = modalInput.value;
          recolorInputs[i].dispatchEvent(new Event("input"));
        }
      }
    }
    // Color 2: Apply card color (12-14), and extra colors (15-23) if extra custom
    if (color2Select.selectedIndex >= customIndex2) {
      const maxIndex = color2Select.selectedIndex >= extraCustomIndex2 ? 12 : 3;
      for (let i = 0; i < maxIndex; i++) {
        const modalInput = document.getElementById("type-edit-recolor" + (i + 12));
        if (modalInput && recolorInputs[i + 12]) {
          recolorInputs[i + 12].value = modalInput.value;
          recolorInputs[i + 12].dispatchEvent(new Event("input"));
        }
      }
    }

    // Apply traveller and trait checkboxes
    const mainTraveller = document.getElementById("traveller");
    const mainTrait = document.getElementById("trait");
    if (mainTraveller && travellerCheckbox) {
      mainTraveller.checked = travellerCheckbox.checked;
      mainTraveller.dispatchEvent(new Event("change"));
    }
    if (mainTrait && traitCheckbox) {
      mainTrait.checked = traitCheckbox.checked;
      mainTrait.dispatchEvent(new Event("change"));
    }

    document.getElementById("type").value = typeInput.value;
    document.getElementById("type").dispatchEvent(new Event("change"));

    document.getElementById("type2").value = heirloomInput.value;
    document.getElementById("type2").dispatchEvent(new Event("change"));

    document.getElementById("deckSize").value = deckSizeInput.value;
    document.getElementById("deckSize").dispatchEvent(new Event("change"));
  }

  closeModalWithAnimation(modal);
}

// Title Edit Modal for mobile
function openTitleEditModal() {
  const modal = document.getElementById("title-edit-modal");
  const titleInput = document.getElementById("title-edit-title");

  // Sync values from main form
  titleInput.value = document.getElementById("title").value;

  openModalWithAnimation(modal);
}

function closeTitleEditModal(apply) {
  const modal = document.getElementById("title-edit-modal");

  if (apply) {
    const titleInput = document.getElementById("title-edit-title");
    document.getElementById("title").value = titleInput.value;
    document.getElementById("title").dispatchEvent(new Event("change"));
  }

  closeModalWithAnimation(modal);
}

// Credit Edit Modal for mobile
function openCreditEditModal() {
  const modal = document.getElementById("credit-edit-modal");
  const artInput = document.getElementById("credit-edit-art");
  const versionInput = document.getElementById("credit-edit-version");

  // Sync values from main form
  artInput.value = document.getElementById("credit").value;
  versionInput.value = document.getElementById("creator").value;

  openModalWithAnimation(modal);
}

function closeCreditEditModal(apply) {
  const modal = document.getElementById("credit-edit-modal");

  if (apply) {
    const artInput = document.getElementById("credit-edit-art");
    const versionInput = document.getElementById("credit-edit-version");

    document.getElementById("credit").value = artInput.value;
    document.getElementById("credit").dispatchEvent(new Event("change"));

    document.getElementById("creator").value = versionInput.value;
    document.getElementById("creator").dispatchEvent(new Event("change"));
  }

  closeModalWithAnimation(modal);
}

// Preview Edit Modal for mobile
function togglePreviewEditLegend() {
  const legendContainer = document.getElementById("preview-edit-legend");
  if (!legendContainer) return;

  if (legendContainer.classList.contains("hidden")) {
    legendContainer.classList.remove("hidden", "closing");
  } else {
    legendContainer.classList.add("closing");
    legendContainer.addEventListener(
      "animationend",
      () => {
        legendContainer.classList.add("hidden");
        legendContainer.classList.remove("closing");
      },
      { once: true },
    );
  }
}

function openPreviewEditModal() {
  const modal = document.getElementById("preview-edit-modal");
  const previewInput = document.getElementById("preview-edit-preview");
  const legendContainer = document.getElementById("preview-edit-legend");

  // Clone legend if not already done
  if (!legendContainer.hasChildNodes()) {
    const legend = document.getElementById("legend");
    legendContainer.appendChild(legend.cloneNode(true));
    legendContainer.firstChild.removeAttribute("id");
  }

  // Sync value from main form
  previewInput.value = document.getElementById("preview").value;

  openModalWithAnimation(modal);
}

function closePreviewEditModal(apply) {
  const modal = document.getElementById("preview-edit-modal");

  if (apply) {
    const previewInput = document.getElementById("preview-edit-preview");
    document.getElementById("preview").value = previewInput.value;
    document.getElementById("preview").dispatchEvent(new Event("change"));
  }

  // Hide legend if visible
  const legendContainer = document.getElementById("preview-edit-legend");
  if (legendContainer && !legendContainer.classList.contains("hidden")) {
    legendContainer.classList.add("hidden");
    legendContainer.classList.remove("closing");
  }

  closeModalWithAnimation(modal);
}

// Cost Edit Modal for mobile
function toggleCostEditLegend() {
  const legendContainer = document.getElementById("cost-edit-legend");
  if (!legendContainer) return;

  if (legendContainer.classList.contains("hidden")) {
    legendContainer.classList.remove("hidden", "closing");
  } else {
    legendContainer.classList.add("closing");
    legendContainer.addEventListener(
      "animationend",
      () => {
        legendContainer.classList.add("hidden");
        legendContainer.classList.remove("closing");
      },
      { once: true },
    );
  }
}

function openCostEditModal() {
  const modal = document.getElementById("cost-edit-modal");
  const priceInput = document.getElementById("cost-edit-price");
  const legendContainer = document.getElementById("cost-edit-legend");

  // Clone legend if not already done
  if (!legendContainer.hasChildNodes()) {
    const legend = document.getElementById("legend");
    legendContainer.appendChild(legend.cloneNode(true));
    legendContainer.firstChild.removeAttribute("id");
  }

  // Sync values from main form
  priceInput.value = document.getElementById("price").value;

  openModalWithAnimation(modal);
}

function closeCostEditModal(apply) {
  const modal = document.getElementById("cost-edit-modal");

  if (apply) {
    const priceInput = document.getElementById("cost-edit-price");

    document.getElementById("price").value = priceInput.value;
    document.getElementById("price").dispatchEvent(new Event("change"));
  }

  // Hide legend if visible
  const legendContainer = document.getElementById("cost-edit-legend");
  if (legendContainer && !legendContainer.classList.contains("hidden")) {
    legendContainer.classList.add("hidden");
    legendContainer.classList.remove("closing");
  }

  closeModalWithAnimation(modal);
}

// Expansion Edit Modal for mobile
let expansionEditPendingIconFile = null;

function openExpansionEditModal() {
  const modal = document.getElementById("expansion-edit-modal");
  const nameInput = document.getElementById("expansion-edit-name");
  const iconInput = document.getElementById("expansion-edit-icon");
  const iconUpload = document.getElementById("expansion-edit-icon-upload");

  // Reset pending file
  expansionEditPendingIconFile = null;
  iconUpload.value = "";

  // Sync values from main form
  nameInput.value = document.getElementById("expansionName").value;
  iconInput.value = document.getElementById("expansion").value;

  openModalWithAnimation(modal);
}

function closeExpansionEditModal(apply) {
  const modal = document.getElementById("expansion-edit-modal");

  if (apply) {
    const nameInput = document.getElementById("expansion-edit-name");
    const iconInput = document.getElementById("expansion-edit-icon");

    document.getElementById("expansionName").value = nameInput.value;
    document.getElementById("expansionName").dispatchEvent(new Event("change"));

    // Handle expansion icon - either uploaded file or URL
    if (expansionEditPendingIconFile) {
      document.getElementById("expansion").value = "[local image]";
      window.onUploadImage(17, expansionEditPendingIconFile);
    } else if (iconInput.value !== document.getElementById("expansion").value) {
      document.getElementById("expansion").value = iconInput.value;
      document.getElementById("expansion").dispatchEvent(new Event("change"));
    }
  }

  expansionEditPendingIconFile = null;
  closeModalWithAnimation(modal);
}

// Setup all mobile modal upload handlers
function setupMobileModalUploadHandlers() {
  // Text edit custom icon upload
  const textEditUpload = document.getElementById("text-edit-custom-icon-upload");
  if (textEditUpload) {
    textEditUpload.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        document.getElementById("text-edit-custom-icon").value = "[local image]";
        document.getElementById("custom-icon").value = "[local image]";
        window.onUploadImage(images.length - 1, this.files[0]);
      }
    });
  }

  // Picture edit upload
  const pictureEditUpload = document.getElementById("picture-edit-upload");
  if (pictureEditUpload) {
    pictureEditUpload.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        document.getElementById("picture-edit-url").value = "[local image]";
        document.getElementById("picture").value = "[local image]";
        window.onUploadImage(5, this.files[0]);
        updateTapOverlayStates();
      }
    });
  }

  // Expansion edit icon upload
  const expansionEditUpload = document.getElementById("expansion-edit-icon-upload");
  if (expansionEditUpload) {
    expansionEditUpload.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        document.getElementById("expansion-edit-icon").value = "[local image]";
        document.getElementById("expansion").value = "[local image]";
        window.onUploadImage(17, this.files[0]);
      }
    });
  }
}

// Update tap overlay empty states based on input values
function updateTapOverlayStates() {
  if (window.innerWidth > 600) return;

  const overlays = {
    preview: document.querySelectorAll('.tap-overlay[data-area="preview"]'),
    title: document.querySelectorAll('.tap-overlay[data-area="title"]'),
    picture: document.querySelectorAll('.tap-overlay[data-area="picture"]'),
    text: document.querySelectorAll('.tap-overlay[data-area="text"]'),
    type: document.querySelectorAll('.tap-overlay[data-area="type"]'),
    cost: document.querySelectorAll('.tap-overlay[data-area="cost"]'),
    expansion: document.querySelectorAll('.tap-overlay[data-area="expansion"]'),
    credit: document.querySelectorAll('.tap-overlay[data-area="credit"]'),
  };

  const isEmpty = {
    preview: !document.getElementById("preview")?.value,
    title: !document.getElementById("title")?.value,
    picture: !document.getElementById("picture")?.value,
    text: !document.getElementById("description")?.value,
    type: !document.getElementById("type")?.value,
    cost: !document.getElementById("price")?.value,
    expansion: !document.getElementById("expansion")?.value && !document.getElementById("expansionName")?.value,
    credit: !document.getElementById("credit")?.value && !document.getElementById("creator")?.value,
  };

  for (const [area, elements] of Object.entries(overlays)) {
    elements.forEach((el) => {
      if (isEmpty[area]) {
        el.classList.add("empty");
      } else {
        el.classList.remove("empty");
      }

      // Hide picture overlay completely when image is specified
      if (area === "picture") {
        if (isEmpty[area]) {
          el.classList.remove("has-content");
        } else {
          el.classList.add("has-content");
        }
      }
    });
  }
}

// Setup tap overlay click handlers
function setupTapOverlayHandlers() {
  if (window.innerWidth > 600) return;

  const handlers = {
    preview: openPreviewEditModal,
    title: openTitleEditModal,
    picture: openPictureEditModal,
    text: openTextEditModal,
    type: openTypeEditModal,
    cost: openCostEditModal,
    expansion: openExpansionEditModal,
    credit: openCreditEditModal,
  };

  document.querySelectorAll(".tap-overlay").forEach((overlay) => {
    overlay.addEventListener("click", function (e) {
      e.stopPropagation();
      const area = this.dataset.area;
      if (handlers[area]) {
        handlers[area]();
      }
    });
  });
}

// Setup real-time updates for modal inputs
function setupModalRealtimeUpdates() {
  // Text edit modal
  const textEditTextarea = document.getElementById("text-edit-textarea");
  if (textEditTextarea) {
    textEditTextarea.addEventListener("input", () => {
      document.getElementById("description").value = textEditTextarea.value;
      document.getElementById("description").dispatchEvent(new Event("input"));
    });
  }

  const textEditBoldkeys = document.getElementById("text-edit-boldkeys");
  if (textEditBoldkeys) {
    textEditBoldkeys.addEventListener("input", () => {
      document.getElementById("boldkeys").value = textEditBoldkeys.value;
      document.getElementById("boldkeys").dispatchEvent(new Event("change"));
    });
  }

  const textEditCustomIcon = document.getElementById("text-edit-custom-icon");
  if (textEditCustomIcon) {
    const updateCustomIcon = () => {
      if (textEditCustomIcon.value !== "[local image]") {
        const url = textEditCustomIcon.value.trim();
        document.getElementById("custom-icon").value = url;
        document.getElementById("custom-icon-upload").value = "";
        window.onChangeExternalImage(images.length - 1, url);
      }
    };
    textEditCustomIcon.addEventListener("change", updateCustomIcon);
    textEditCustomIcon.addEventListener("blur", updateCustomIcon);
  }

  // Picture edit modal
  const pictureEditUrl = document.getElementById("picture-edit-url");
  if (pictureEditUrl) {
    const updatePictureUrl = () => {
      if (pictureEditUrl.value !== "[local image]") {
        const url = pictureEditUrl.value.trim();
        document.getElementById("picture").value = url;
        document.getElementById("picture-upload").value = "";
        window.onChangeExternalImage(5, url);
        updateTapOverlayStates();
      }
    };
    pictureEditUrl.addEventListener("change", updatePictureUrl);
    pictureEditUrl.addEventListener("blur", updatePictureUrl);
  }

  const pictureEditX = document.getElementById("picture-edit-x");
  const pictureEditY = document.getElementById("picture-edit-y");
  const pictureEditZoom = document.getElementById("picture-edit-zoom");
  const pictureEditXSlider = document.getElementById("picture-edit-x-slider");
  const pictureEditYSlider = document.getElementById("picture-edit-y-slider");
  const pictureEditZoomSlider = document.getElementById("picture-edit-zoom-slider");

  // Sync number inputs to sliders and trigger update
  [pictureEditX, pictureEditY, pictureEditZoom].forEach((el) => {
    if (el) {
      el.addEventListener("input", () => {
        // Sync to sliders (clamp to slider range)
        if (pictureEditXSlider) pictureEditXSlider.value = Math.max(-2, Math.min(2, pictureEditX.value));
        if (pictureEditYSlider) pictureEditYSlider.value = Math.max(-2, Math.min(2, pictureEditY.value));
        if (pictureEditZoomSlider) pictureEditZoomSlider.value = Math.max(0.1, Math.min(3, pictureEditZoom.value));
        // Trigger real-time update
        document.getElementById("picture-x").value = pictureEditX.value;
        document.getElementById("picture-y").value = pictureEditY.value;
        document.getElementById("picture-zoom").value = pictureEditZoom.value;
        document.getElementById("picture-zoom").dispatchEvent(new Event("change"));
      });
    }
  });

  // Sync sliders to number inputs and trigger update
  [pictureEditXSlider, pictureEditYSlider, pictureEditZoomSlider].forEach((slider) => {
    if (slider) {
      slider.addEventListener("input", () => {
        pictureEditX.value = pictureEditXSlider.value;
        pictureEditY.value = pictureEditYSlider.value;
        pictureEditZoom.value = pictureEditZoomSlider.value;
        // Trigger real-time update
        document.getElementById("picture-x").value = pictureEditX.value;
        document.getElementById("picture-y").value = pictureEditY.value;
        document.getElementById("picture-zoom").value = pictureEditZoom.value;
        document.getElementById("picture-zoom").dispatchEvent(new Event("change"));
      });
    }
  });

  // PC version sliders
  const pictureX = document.getElementById("picture-x");
  const pictureY = document.getElementById("picture-y");
  const pictureZoom = document.getElementById("picture-zoom");
  const pictureXSlider = document.getElementById("picture-x-slider");
  const pictureYSlider = document.getElementById("picture-y-slider");
  const pictureZoomSlider = document.getElementById("picture-zoom-slider");

  // Sync PC number inputs to sliders
  [pictureX, pictureY, pictureZoom].forEach((el) => {
    if (el) {
      el.addEventListener("input", () => {
        if (pictureXSlider) pictureXSlider.value = Math.max(-1, Math.min(1, pictureX.value));
        if (pictureYSlider) pictureYSlider.value = Math.max(-1, Math.min(1, pictureY.value));
        if (pictureZoomSlider) pictureZoomSlider.value = Math.max(0.1, Math.min(3, pictureZoom.value));
      });
    }
  });

  // Sync PC sliders to number inputs and trigger update
  [pictureXSlider, pictureYSlider, pictureZoomSlider].forEach((slider) => {
    if (slider) {
      slider.addEventListener("input", () => {
        pictureX.value = pictureXSlider.value;
        pictureY.value = pictureYSlider.value;
        pictureZoom.value = pictureZoomSlider.value;
        pictureZoom.dispatchEvent(new Event("change"));
      });
    }
  });

  // Type edit modal
  const typeEditColor1 = document.getElementById("type-edit-color1");
  if (typeEditColor1) {
    typeEditColor1.addEventListener("change", () => {
      const mainSelect = document.getElementById("normalcolor1");
      mainSelect.selectedIndex = typeEditColor1.selectedIndex;
      mainSelect.dispatchEvent(new Event("change"));
    });
  }

  const typeEditColor2 = document.getElementById("type-edit-color2");
  if (typeEditColor2) {
    typeEditColor2.addEventListener("change", () => {
      const mainSelect = document.getElementById("normalcolor2");
      mainSelect.selectedIndex = typeEditColor2.selectedIndex;
      mainSelect.dispatchEvent(new Event("change"));
    });
  }

  const typeEditType = document.getElementById("type-edit-type");
  if (typeEditType) {
    typeEditType.addEventListener("input", () => {
      document.getElementById("type").value = typeEditType.value;
      document.getElementById("type").dispatchEvent(new Event("change"));
    });
  }

  const typeEditHeirloom = document.getElementById("type-edit-heirloom");
  if (typeEditHeirloom) {
    typeEditHeirloom.addEventListener("input", () => {
      document.getElementById("type2").value = typeEditHeirloom.value;
      document.getElementById("type2").dispatchEvent(new Event("change"));
    });
  }

  const typeEditDecksize = document.getElementById("type-edit-decksize");
  if (typeEditDecksize) {
    typeEditDecksize.addEventListener("input", () => {
      document.getElementById("deckSize").value = typeEditDecksize.value;
      document.getElementById("deckSize").dispatchEvent(new Event("change"));
    });
  }

  // Type edit modal - traveller and trait checkboxes
  const typeEditTraveller = document.getElementById("type-edit-traveller");
  if (typeEditTraveller) {
    typeEditTraveller.addEventListener("change", () => {
      const mainCheckbox = document.getElementById("traveller");
      mainCheckbox.checked = typeEditTraveller.checked;
      mainCheckbox.dispatchEvent(new Event("change"));
    });
  }

  const typeEditTrait = document.getElementById("type-edit-trait");
  if (typeEditTrait) {
    typeEditTrait.addEventListener("change", () => {
      const mainCheckbox = document.getElementById("trait");
      mainCheckbox.checked = typeEditTrait.checked;
      mainCheckbox.dispatchEvent(new Event("change"));
    });
  }

  // Type edit modal - custom color inputs
  const recolorInputs = document.getElementsByName("recolor");
  for (let i = 0; i < 24; i++) {
    const modalInput = document.getElementById("type-edit-recolor" + i);
    if (modalInput && recolorInputs[i]) {
      modalInput.addEventListener("input", () => {
        recolorInputs[i].value = modalInput.value;
        recolorInputs[i].dispatchEvent(new Event("input"));
      });
    }
  }

  // Type edit modal - split position
  const typeEditSplit = document.getElementById("type-edit-split");
  if (typeEditSplit) {
    typeEditSplit.addEventListener("change", () => {
      const mainSplit = document.getElementById("color2split");
      mainSplit.value = typeEditSplit.value;
      mainSplit.dispatchEvent(new Event("change"));
    });
  }

  // Title edit modal
  const titleEditTitle = document.getElementById("title-edit-title");
  if (titleEditTitle) {
    titleEditTitle.addEventListener("input", () => {
      document.getElementById("title").value = titleEditTitle.value;
      document.getElementById("title").dispatchEvent(new Event("change"));
    });
  }

  // Preview edit modal
  const previewEditPreview = document.getElementById("preview-edit-preview");
  if (previewEditPreview) {
    previewEditPreview.addEventListener("input", () => {
      document.getElementById("preview").value = previewEditPreview.value;
      document.getElementById("preview").dispatchEvent(new Event("change"));
    });
  }

  // Cost edit modal
  const costEditPrice = document.getElementById("cost-edit-price");
  if (costEditPrice) {
    costEditPrice.addEventListener("input", () => {
      document.getElementById("price").value = costEditPrice.value;
      document.getElementById("price").dispatchEvent(new Event("change"));
    });
  }

  // Expansion edit modal
  const expansionEditName = document.getElementById("expansion-edit-name");
  if (expansionEditName) {
    expansionEditName.addEventListener("input", () => {
      document.getElementById("expansionName").value = expansionEditName.value;
      document.getElementById("expansionName").dispatchEvent(new Event("change"));
    });
  }

  const expansionEditIcon = document.getElementById("expansion-edit-icon");
  if (expansionEditIcon) {
    const updateExpansionIcon = () => {
      if (expansionEditIcon.value !== "[local image]") {
        const url = expansionEditIcon.value.trim();
        document.getElementById("expansion").value = url;
        document.getElementById("expansion-upload").value = "";
        window.onChangeExternalImage(17, url);
      }
    };
    expansionEditIcon.addEventListener("change", updateExpansionIcon);
    expansionEditIcon.addEventListener("blur", updateExpansionIcon);
  }

  // Credit edit modal
  const creditEditArt = document.getElementById("credit-edit-art");
  if (creditEditArt) {
    creditEditArt.addEventListener("input", () => {
      document.getElementById("credit").value = creditEditArt.value;
      document.getElementById("credit").dispatchEvent(new Event("change"));
    });
  }

  const creditEditVersion = document.getElementById("credit-edit-version");
  if (creditEditVersion) {
    creditEditVersion.addEventListener("input", () => {
      document.getElementById("creator").value = creditEditVersion.value;
      document.getElementById("creator").dispatchEvent(new Event("change"));
    });
  }
}

// Setup click-outside-to-close for edit modals
function setupEditModalBackdropClose() {
  const modalCloseMap = {
    "text-edit-modal": () => closeTextEditModal(false),
    "type-edit-modal": () => closeTypeEditModal(false),
    "title-edit-modal": () => closeTitleEditModal(false),
    "preview-edit-modal": () => closePreviewEditModal(false),
    "cost-edit-modal": () => closeCostEditModal(false),
    "expansion-edit-modal": () => closeExpansionEditModal(false),
    "credit-edit-modal": () => closeCreditEditModal(false),
    "picture-edit-modal": () => closePictureEditModal(false),
  };

  document.querySelectorAll(".edit-modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      // Close only when clicking the modal backdrop itself, not the content
      if (e.target === modal) {
        const closeFunc = modalCloseMap[modal.id];
        if (closeFunc) closeFunc();
      }
    });
  });
}

// Initialize mobile handlers when DOM is ready
function initMobileHandlers() {
  setupMobileModalUploadHandlers();
  setupTapOverlayHandlers();
  setupModalRealtimeUpdates();
  setupEditModalBackdropClose();
  updateTapOverlayStates();

  // Update overlay states when inputs change
  const inputIds = ["preview", "title", "expansionName", "picture", "description", "type", "price", "expansion", "credit", "creator", "trait"];
  inputIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", updateTapOverlayStates);
      el.addEventListener("change", updateTapOverlayStates);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMobileHandlers);
} else {
  initMobileHandlers();
}

// function to reset form while preserving size
async function resetForm() {
  if (await showConfirm("入力内容をリセットしてもよろしいですか？")) {
    window.location.href = "?size=" + templateSize;
  }
  return false;
}

// function to download the finished card
async function downloadPicture() {
  function isTainted(ctx) {
    // https://stackoverflow.com/a/22581873
    try {
      var pixel = ctx.getImageData(0, 0, 1, 1);
      return false;
    } catch (err) {
      return err.code === 18;
    }
  }

  function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(","),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      n = bstr.length,
      u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {
      type: mime,
    });
  }

  var id;
  if (templateSize == 0 || templateSize == 2 || templateSize == 3) {
    id = 0;
  } else if (templateSize == 1 || templateSize == 4) {
    id = 1;
  } else {
    id = 2;
  }
  var link = document.getElementById("download");
  var canvases = document.getElementsByClassName("myCanvas");
  var canvas = canvases[id];

  if (isTainted(canvas)) {
    await showAlert("Sorry, canvas is tainted! Please use the right-click-option to save your image.");
    return;
  } else {
    var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    var title = document.getElementById("title").value.trim();
    var creator = document.getElementById("creator").value.trim();
    var fileName = "";
    if (title.length > 0) {
      fileName += title;
    } else {
      fileName += "card";
    }
    if (creator.length > 0) {
      fileName += "_" + creator.split(" ")[0];
    }
    fileName = fileName.split(" ").join("_");
    fileName += ".png";
    link.setAttribute("download", fileName);
    var url = (window.webkitURL || window.URL).createObjectURL(dataURLtoBlob(image));
    link.setAttribute("href", url);
    link.addEventListener("click", () => {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
}

class CardDatabase extends Dexie {
  constructor() {
    super("DominionCardGenerator");

    // Define database schema
    this.version(1).stores({
      favorites: "++id, timestamp",
      live_images: "id",
    });

    this.version(2).stores({
      favorites: "++id, timestamp",
      live_images: "id",
    });

    this.version(3).stores({
      favorites: "++id, timestamp",
      live_images: "id",
    });

    // Version 4: Add thumbnails store
    this.version(4)
      .stores({
        favorites: "++id, timestamp",
        live_images: "id",
        thumbnails: "id", // Thumbnail ID matches card ID
      })
      .upgrade(async (trans) => {
        // Migrate existing thumbnails to separate store
        const favorites = trans.table("favorites");
        const thumbnails = trans.table("thumbnails");

        await favorites.toCollection().modify(async (card) => {
          if (card.thumbnail && card.thumbnail !== "failed") {
            // Save thumbnail to new store
            await thumbnails.put({ id: card.id, data: card.thumbnail });
          }
          // Remove old thumbnail fields
          delete card.thumbnail;
          delete card.thumbnailId;
        });
      });

    // Table shortcuts
    this.favorites = this.table("favorites");
    this.liveImages = this.table("live_images");
    this.thumbnails = this.table("thumbnails");
  }

  async init() {
    // Dexie handles initialization automatically
    // Just open the database
    await this.open();
  }

  // Extract custom color settings from query params
  extractCustomColors(q) {
    const colors = {};
    for (const key in q) {
      if (key.match(/^c\d\.\d(\.\d)?$/)) {
        colors[key] = q[key];
      }
    }
    return colors;
  }

  // Convert card data to URL params string
  static dataToParams(data) {
    const params = new URLSearchParams();
    if (data.title) params.set("title", data.title);
    if (data.title2) params.set("title2", data.title2);
    if (data.description) params.set("description", data.description);
    if (data.description2) params.set("description2", data.description2);
    if (data.type) params.set("type", data.type);
    if (data.type2) params.set("type2", data.type2);
    if (data.price) params.set("price", data.price);
    if (data.preview) params.set("preview", data.preview);
    if (data.credit) params.set("credit", data.credit);
    if (data.creator) params.set("creator", data.creator);
    if (data.expansionName) params.set("expansionName", data.expansionName);
    if (data.boldkeys) params.set("boldkeys", data.boldkeys);
    if (data.deckSize) params.set("deckSize", data.deckSize);
    if (data.size) params.set("size", data.size);
    if (data.color0) params.set("color0", data.color0);
    if (data.color1) params.set("color1", data.color1);
    if (data.traveller) params.set("traveller", data.traveller);
    if (data.trait) params.set("trait", data.trait);
    if (data.pictureX) params.set("picture-x", data.pictureX);
    if (data.pictureY) params.set("picture-y", data.pictureY);
    if (data.pictureZoom) params.set("picture-zoom", data.pictureZoom);
    if (data.picture) params.set("picture", data.picture);
    if (data.expansion) params.set("expansion", data.expansion);
    if (data.customIcon) params.set("custom-icon", data.customIcon);
    // Custom colors
    if (data.customColors) {
      for (const key in data.customColors) {
        params.set(key, data.customColors[key]);
      }
    }
    const str = params.toString();
    return str ? "?" + str : "";
  }

  // Build card data from current form values
  static buildDataFromForm() {
    const getVal = (id) => document.getElementById(id)?.value || "";
    const getChecked = (id) => (document.getElementById(id)?.checked ? "true" : "");

    const isDoubleCard = templateSize === 2;

    const data = {
      title: getVal("title"),
      description: getVal("description"),
      type: getVal("type"),
      price: getVal("price"),
      preview: getVal("preview"),
      credit: getVal("credit"),
      creator: getVal("creator"),
      expansionName: getVal("expansionName"),
      boldkeys: getVal("boldkeys"),
      deckSize: getVal("deckSize"),
      size: String(templateSize),
      color0: String(document.getElementById("normalcolor1")?.selectedIndex || 0),
      color1: String(document.getElementById("normalcolor2")?.selectedIndex || 0),
      traveller: getChecked("traveller"),
      trait: getChecked("trait"),
      pictureX: getVal("picture-x"),
      pictureY: getVal("picture-y"),
      pictureZoom: getVal("picture-zoom"),
      picture: getVal("picture"),
      expansion: getVal("expansion"),
      customIcon: getVal("custom-icon"),
      customColors: {},
    };

    // Add double card specific fields only for double card (size 2)
    if (isDoubleCard) {
      data.title2 = getVal("title2");
      data.description2 = getVal("description2");
      data.type2 = getVal("type2");
    }

    // Extract custom colors from recolor inputs only if Custom or Extra Custom is selected
    const recolorInputs = document.getElementsByName("recolor");
    const normalColorDropdowns = document.getElementsByName("normalcolor");
    for (let id = 0; id < 2; id++) {
      const dropdown = normalColorDropdowns[id];
      if (dropdown) {
        const selectedIndex = dropdown.selectedIndex;
        const optionCount = dropdown.options.length;
        // Custom is second-to-last option, Extra Custom is last option
        const isCustom = selectedIndex === optionCount - 2;
        const isExtraCustom = selectedIndex === optionCount - 1;

        if (isCustom) {
          // Save c{id}.{i} format for Custom mode
          for (let i = 0; i < 3; i++) {
            const input = recolorInputs[12 * id + i];
            if (input && input.value) {
              data.customColors[`c${id}.${i}`] = input.value;
            }
          }
        } else if (isExtraCustom) {
          // Save c{id}.{row}.{col} format for Extra Custom mode
          for (let i = 0; i < 12; i++) {
            const input = recolorInputs[12 * id + i];
            if (input && input.value) {
              data.customColors[`c${id}.${Math.floor(i / 3)}.${i % 3}`] = input.value;
            }
          }
        }
      }
    }

    return data;
  }

  // Get params string from card (handles both old and new format)
  static getParams(card) {
    if (!card) return "";
    if (card.data) {
      return CardDatabase.dataToParams(card.data);
    }
    return card.params || "";
  }

  // Get data object from card (handles both old and new format)
  static getData(card) {
    if (!card) return {};
    if (card.data) {
      return card.data;
    }
    if (card.params) {
      return getQueryParams(card.params);
    }
    return {};
  }

  async getAll() {
    return await this.favorites.toArray();
  }

  async add(card) {
    return await this.favorites.add(card);
  }

  async delete(id) {
    // Delete both card and thumbnail in transaction
    await this.transaction("rw", [this.favorites, this.thumbnails], async () => {
      await this.favorites.delete(id);
      await this.thumbnails.delete(id);
    });
  }

  async update(card) {
    return await this.favorites.put(card);
  }

  async get(id) {
    return await this.favorites.get(id);
  }

  async getThumbnail(id) {
    const thumb = await this.thumbnails.get(id);
    return thumb ? thumb.data : null;
  }

  async getAllThumbnailIds() {
    return await this.thumbnails.toCollection().primaryKeys();
  }

  async saveThumbnail(cardId, thumbnail) {
    await this.thumbnails.put({ id: cardId, data: thumbnail });
  }

  async deleteThumbnail(cardId) {
    if (!cardId) return;
    await this.thumbnails.delete(cardId);
  }

  async saveLiveImage(id, data) {
    await this.liveImages.put({ id, data, timestamp: Date.now() });
  }

  async getLiveImage(id) {
    const result = await this.liveImages.get(id);
    return result ? result.data : null;
  }

  async deleteLiveImage(id) {
    await this.liveImages.delete(id);
  }
}

function Favorites(name) {
  var name = name;
  var fav = document.getElementById("manage-favorites");
  var favList = document.getElementById("favorites-list");
  var favThumbnails = document.getElementById("favorites-thumbnails");
  var viewToggleBtn = document.getElementById("favorites-view-toggle");
  var db = new CardDatabase();
  var data = [];
  var ascending = true;
  var sortState = JSON.parse(localStorage.getItem("favoritesSortState") || "[]"); // Array of {column: string, direction: 'asc'|'desc'}

  // Mobile detection
  const isMobile = () => {
    return window.innerWidth <= 600 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  };

  // Default to list view on mobile for better performance
  var viewMode = localStorage.getItem("favoritesViewMode") || (isMobile() ? "list" : "thumbnail"); // "list" or "thumbnail"
  var cardCountEl = document.getElementById("favorites-card-count");
  var showOfficial = localStorage.getItem("favoritesShowOfficial") !== "false"; // default true
  var officialToggleBtn = document.getElementById("favorites-official-toggle");
  var rememberedIconWidths = JSON.parse(localStorage.getItem("favoritesIconWidths") || "{}");

  // Virtual scrolling for thumbnails
  var thumbnailDataMap = new Map(); // id -> {item, data, params}
  var thumbnailObserver = null;
  var thumbnailQueue = []; // Queue of cards waiting to render
  var isProcessingThumbnailQueue = false; // Whether queue processor is running

  // Debounce timer for refresh
  var refreshDebounceTimer = null;
  var refreshDebounceDelay = 150;

  // Saved scroll position for restoring after close/reopen
  var savedScrollTop = 0;

  // Update official toggle button state
  const updateOfficialToggleButton = () => {
    if (officialToggleBtn) {
      officialToggleBtn.classList.toggle("active", showOfficial);
    }
  };

  // Update card count display
  var lastTotalCount = 0;
  const updateCardCount = (visibleCount, totalCount) => {
    if (totalCount !== undefined) {
      lastTotalCount = totalCount;
    }
    if (cardCountEl) {
      if (visibleCount === lastTotalCount) {
        cardCountEl.textContent = `${lastTotalCount}枚`;
      } else {
        cardCountEl.textContent = `${visibleCount}/${lastTotalCount}枚`;
      }
    }
  };

  // Sort data based on current sortState
  const sortData = (data) => {
    if (sortState.length === 0) return data;

    return data.slice().sort((a, b) => {
      for (const sort of sortState) {
        const aData = CardDatabase.getData(a);
        const bData = CardDatabase.getData(b);
        let aVal, bVal;

        switch (sort.column) {
          case "expansion":
            aVal = (aData.expansionName || "").trim().toLowerCase();
            bVal = (bData.expansionName || "").trim().toLowerCase();
            break;
          case "size":
            aVal = parseInt(aData.size || "0");
            bVal = parseInt(bData.size || "0");
            break;
          case "cost":
            {
              // Parse cost: extract numeric value, handle $ and special symbols
              // Returns { hasNumber: boolean, value: number }
              const parseCost = (price) => {
                if (!price || price.trim() === "-") return { hasNumber: false, value: 0 };
                const match = price.match(/\d+/);
                return match ? { hasNumber: true, value: parseInt(match[0]) } : { hasNumber: false, value: 0 };
              };
              const aCost = parseCost(aData.price);
              const bCost = parseCost(bData.price);
              // Numbers first, "-" last (regardless of sort direction)
              if (aCost.hasNumber && !bCost.hasNumber) {
                return -1; // a has number, b doesn't -> a comes first
              }
              if (!aCost.hasNumber && bCost.hasNumber) {
                return 1; // b has number, a doesn't -> b comes first
              }
              aVal = aCost.value;
              bVal = bCost.value;
            }
            break;
          case "title":
            aVal = (aData.title || "").trim().toLowerCase();
            bVal = (bData.title || "").trim().toLowerCase();
            break;
          case "type":
            aVal = (aData.type || "").trim().toLowerCase();
            bVal = (bData.type || "").trim().toLowerCase();
            break;
          case "description":
            aVal = (aData.description || "").trim().toLowerCase();
            bVal = (bData.description || "").trim().toLowerCase();
            break;
          default:
            continue;
        }

        let comparison = 0;
        if (typeof aVal === "string") {
          comparison = aVal.localeCompare(bVal);
        } else {
          comparison = aVal - bVal;
        }

        if (comparison !== 0) {
          return sort.direction === "asc" ? comparison : -comparison;
        }
      }
      return 0;
    });
  };

  // Helper function to generate thumbnail from a canvas element
  const generateThumbnailFromCanvas = (canvas, isLandscape, isOfficial = false) => {
    if (!canvas) return null;

    try {
      // Create a smaller thumbnail for display
      const maxSize = 800;
      const thumbCanvas = document.createElement("canvas");
      const ctx = thumbCanvas.getContext("2d");

      if (isLandscape) {
        // Rotate landscape cards 90 degrees clockwise
        const scale = Math.min(maxSize / canvas.height, maxSize / canvas.width);
        thumbCanvas.width = canvas.height * scale;
        thumbCanvas.height = canvas.width * scale;
        ctx.translate(thumbCanvas.width / 2, thumbCanvas.height / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(canvas, -thumbCanvas.height / 2, -thumbCanvas.width / 2, thumbCanvas.height, thumbCanvas.width);
      } else {
        const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height);
        thumbCanvas.width = canvas.width * scale;
        thumbCanvas.height = canvas.height * scale;
        ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      }

      return thumbCanvas.toDataURL("image/png", 0.8);
    } catch (e) {
      console.error("Failed to generate thumbnail:", e);
      return null;
    }
  };

  // Generate thumbnail from current canvas
  const generateThumbnail = (isOfficial = false) => {
    const canvases = document.getElementsByClassName("myCanvas");

    // Select canvas based on templateSize (matching draw() logic)
    let canvasIndex;
    const isLandscape = templateSize === 1 || templateSize === 4;
    if (templateSize === 0 || templateSize === 2 || templateSize === 3) {
      canvasIndex = 0;
    } else if (isLandscape) {
      canvasIndex = 1;
    } else {
      canvasIndex = 2;
    }

    const canvas = canvases[canvasIndex];
    return generateThumbnailFromCanvas(canvas, isLandscape, isOfficial);
  };

  // Update view toggle button text
  const updateViewToggleButton = () => {
    if (!viewToggleBtn) return;
    const listSpan = viewToggleBtn.querySelector(".view-list");
    const thumbSpan = viewToggleBtn.querySelector(".view-thumbnail");
    if (viewMode === "list") {
      listSpan.classList.remove("hidden");
      thumbSpan.classList.add("hidden");
    } else {
      listSpan.classList.add("hidden");
      thumbSpan.classList.remove("hidden");
    }
  };

  this.sortBy = function (column, event) {
    const existing = sortState.findIndex((s) => s.column === column);

    if (existing >= 0) {
      // Clicking on already sorted column: cycle asc -> desc -> remove
      if (sortState[existing].direction === "asc") {
        sortState[existing].direction = "desc";
      } else {
        // Remove this sort column
        sortState.splice(existing, 1);
      }
    } else if (sortState.length > 0) {
      // Already sorting by other column(s), add this column to multi-sort
      sortState.push({ column, direction: "asc" });
    } else {
      // No sort active, start new single sort
      sortState = [{ column, direction: "asc" }];
    }
    // Save sort state to localStorage
    localStorage.setItem("favoritesSortState", JSON.stringify(sortState));
    this.refresh();
  };

  // Auto-import official cards from cards/*.json files
  const autoImportOfficialCards = async () => {
    try {
      // Fetch the index of card files
      const indexResponse = await fetch("cards/index.json");
      if (!indexResponse.ok) return;
      const cardFiles = await indexResponse.json();

      // Get stored import timestamps
      const storedTimestamps = JSON.parse(localStorage.getItem("officialCardsTimestamps") || "{}");

      // First pass: check which files need updating and count total cards
      const filesToUpdate = [];
      let totalCards = 0;

      for (const fileName of cardFiles) {
        try {
          const response = await fetch(`cards/${fileName}`);
          if (!response.ok) continue;
          const fileData = await response.json();

          const fileUpdatedAt = fileData.updated_at;
          const storedUpdatedAt = storedTimestamps[fileName];

          if (!storedUpdatedAt || storedUpdatedAt < fileUpdatedAt) {
            const cards = fileData.cards || [];
            filesToUpdate.push({ fileName, fileData, fileUpdatedAt, cards });
            totalCards += cards.length;
          }
        } catch (e) {
          console.warn(`Failed to fetch ${fileName}:`, e);
        }
      }

      // Skip if nothing to update
      if (filesToUpdate.length === 0) return;

      // Show progress and import
      const progress = showProgress("公式カード更新中...", totalCards);
      let importedCount = 0;

      // Cache existing cards for faster lookup
      const existingCards = await db.getAll();
      const existingMap = new Map();
      for (const c of existingCards) {
        const d = CardDatabase.getData(c);
        const key = `${d.title}|||${d.expansionName}`;
        existingMap.set(key, c);
      }

      for (const { fileName, fileData, fileUpdatedAt, cards } of filesToUpdate) {
        try {
          for (const item of cards) {
            // Mark as official card and record source file
            if (item.data) {
              item.data.official = true;
              item.data.sourceFile = fileName;
            }
            // Remove id to let DB assign new one
            delete item.id;
            // Thumbnail will be skipped for faster import

            // Check if card already exists
            const cardData = CardDatabase.getData(item);
            const key = `${cardData.title}|||${cardData.expansionName}`;
            const existing = existingMap.get(key);

            if (existing) {
              // Update existing card
              item.id = existing.id;
              await db.update(item);
            } else {
              // Add new card
              const newId = await db.add(item);
              // Add to map in case of duplicates in import
              item.id = newId;
              existingMap.set(key, item);
            }

            importedCount++;
            progress.update(importedCount, `${importedCount} / ${totalCards}`);
          }

          // Update stored timestamp
          storedTimestamps[fileName] = fileUpdatedAt;
          console.log(`Imported ${cards.length} cards from ${fileName}`);
        } catch (e) {
          console.warn(`Failed to import ${fileName}:`, e);
        }
      }

      localStorage.setItem("officialCardsTimestamps", JSON.stringify(storedTimestamps));
      progress.close();
    } catch (e) {
      console.warn("Auto-import failed:", e);
    }
  };

  // Queue thumbnail generation for official cards without thumbnails
  const queueThumbnailGeneration = async () => {
    // Check if previous thumbnail generation caused a crash
    const crashFlag = localStorage.getItem("thumbnailGenerationInProgress");
    if (crashFlag) {
      const crashTime = parseInt(crashFlag, 10);
      const now = Date.now();
      // If crash flag was set within the last 5 minutes, skip thumbnail generation
      if (now - crashTime < 5 * 60 * 1000) {
        console.warn("Thumbnail generation skipped due to recent crash. Clear localStorage to retry.");
        localStorage.removeItem("thumbnailGenerationInProgress");
        return;
      }
    }

    const allData = await db.getAll();
    // Get all existing thumbnail IDs
    const existingThumbnailIds = new Set(await db.getAllThumbnailIds());
    // Filter: official cards without thumbnails
    const cardsWithoutThumbnails = allData.filter((item) => item.data?.official && !existingThumbnailIds.has(item.id));

    if (cardsWithoutThumbnails.length === 0) {
      localStorage.removeItem("thumbnailGenerationInProgress");
      return;
    }

    // Set crash detection flag
    localStorage.setItem("thumbnailGenerationInProgress", Date.now().toString());

    // Use backgroundProcessQueue to generate thumbnails
    backgroundProcessQueue.add("サムネイル生成", cardsWithoutThumbnails.length, async (progress) => {
      // Use fewer workers on mobile/iOS to reduce memory pressure
      const workerCount = Math.min(PARALLEL_WORKERS, cardsWithoutThumbnails.length);
      const iframes = [];

      for (let w = 0; w < workerCount; w++) {
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1600px;height:2400px;visibility:hidden;";
        document.body.appendChild(iframe);
        iframes.push(iframe);
      }

      try {
        // Wait for iframes to load
        await Promise.all(
          iframes.map(
            (iframe) =>
              new Promise((resolve) => {
                iframe.onload = resolve;
                // Add _iframe parameter to prevent recursive initialization
                iframe.src = location.pathname + "?_iframe=1";
              }),
          ),
        );

        // Wait for iframes to be ready
        await Promise.all(
          iframes.map(
            (iframe) =>
              new Promise((resolve) => {
                const waitForReady = () => {
                  if (iframe.contentWindow.applyQueryParams && iframe.contentWindow.images) {
                    resolve();
                  } else {
                    setTimeout(waitForReady, 100);
                  }
                };
                waitForReady();
              }),
          ),
        );

        // Render card and generate thumbnail
        const renderThumbnailInIframe = (iframe, item) => {
          return new Promise((resolve) => {
            const iframeWindow = iframe.contentWindow;
            const iframeDoc = iframe.contentDocument;
            const cardData = CardDatabase.getData(item);
            const params = CardDatabase.getParams(item);
            const iframeImages = iframeWindow.images;
            const customIconIndex = iframeImages.length - 1;

            const loadImage = (id, src) => {
              return new Promise((res) => {
                const newImg = new Image();
                let resolved = false;
                const done = () => {
                  if (!resolved) {
                    resolved = true;
                    iframeImages[id] = newImg;
                    res();
                  }
                };
                if (src) {
                  newImg.onload = done;
                  newImg.onerror = done;
                  newImg.crossOrigin = "Anonymous";
                  if (src.substr(0, 11) !== "data:image/" && src.substr(0, 8) !== "file:///") {
                    newImg.src = CORS_ANYWHERE_BASE_URL + src;
                  } else {
                    newImg.src = src;
                  }
                  setTimeout(done, 8000);
                } else {
                  done();
                }
              });
            };

            const illustrationSrc = item.images?.illustration || (cardData.picture && cardData.picture !== "[local image]" ? cardData.picture : null);
            const expansionSrc = item.images?.expansion || (cardData.expansion && cardData.expansion !== "[local image]" ? cardData.expansion : null);
            const customIconSrc = item.images?.customIcon || (cardData.customIcon && cardData.customIcon !== "[local image]" ? cardData.customIcon : null);

            const doRender = async () => {
              await Promise.all([loadImage(5, illustrationSrc), loadImage(17, expansionSrc), loadImage(customIconIndex, customIconSrc)]);

              if (iframeWindow.showLoadingState) {
                iframeWindow.showLoadingState();
              }

              const paramsForRender = new URLSearchParams(params);
              paramsForRender.set("picture", "[iframe]");
              paramsForRender.set("expansion", "[iframe]");
              paramsForRender.set("custom-icon", "[iframe]");
              iframeWindow.applyQueryParams("?" + paramsForRender.toString());

              await new Promise((res) => {
                const check = () => {
                  const canvasWrapper = iframeDoc.querySelector(".canvas-wrapper");
                  if (canvasWrapper && !canvasWrapper.hasAttribute("data-status")) {
                    setTimeout(res, 500);
                  } else {
                    setTimeout(check, 100);
                  }
                };
                setTimeout(check, 100);
              });

              const size = cardData.size || "0";
              const isMat = size === "5";
              const isLandscape = size === "1" || size === "4";

              const canvases = iframeDoc.getElementsByClassName("myCanvas");
              let canvasIndex = 0;
              if (isMat) canvasIndex = 2;
              else if (isLandscape) canvasIndex = 1;

              const canvas = canvases[canvasIndex];
              // Use shared thumbnail generation function (isOfficial = true)
              const thumbnail = generateThumbnailFromCanvas(canvas, isLandscape, true);

              resolve(thumbnail);
            };

            doRender();
          });
        };

        // Process cards in parallel
        let nextIndex = 0;
        let completedCount = 0;

        const processNext = async (workerIndex) => {
          while (nextIndex < cardsWithoutThumbnails.length) {
            const currentIndex = nextIndex++;
            const item = cardsWithoutThumbnails[currentIndex];

            try {
              const thumbnail = await renderThumbnailInIframe(iframes[workerIndex], item);
              if (thumbnail) {
                // Save thumbnail to separate store using card ID
                await db.saveThumbnail(item.id, thumbnail);
              } else {
                console.warn("Thumbnail generation returned null for card:", item.id);
              }
            } catch (e) {
              console.warn("Failed to generate thumbnail for card:", item.id, e);
            }

            completedCount++;
            progress.update(completedCount, `${completedCount} / ${cardsWithoutThumbnails.length}`);
          }
        };

        await Promise.all(iframes.map((_, i) => processNext(i)));
      } finally {
        iframes.forEach((iframe) => iframe.remove());
      }

      progress.close();
      // Clear crash detection flag
      localStorage.removeItem("thumbnailGenerationInProgress");
      // Refresh to show new thumbnails
      this.refresh();
    });
  };

  db.init()
    .then(async () => {
      // Skip auto-import and thumbnail generation when running in iframe
      let isInIframe = false;
      try {
        // Check both window hierarchy and URL parameter for iframe detection
        isInIframe = window.self !== window.top || new URLSearchParams(window.location.search).has("_iframe");
      } catch (e) {
        // Cross-origin iframe access may throw
        isInIframe = true;
      }

      try {
        if (!isInIframe) {
          await autoImportOfficialCards();
        }
        this.refresh();
        // Queue thumbnail generation after refresh (runs in background, skip in iframe)
        if (!isInIframe) {
          queueThumbnailGeneration();
        }
      } catch (e) {
        console.error("Favorites initialization error:", e);
        this.refresh();
      }
    })
    .catch((e) => {
      console.error("Favorites db.init() failed:", e);
    });

  this.getDB = function () {
    return db;
  };

  const renderCostIcons = (price) => {
    const container = document.createElement("div");
    container.className = "cost-icons-container";

    if (!price) return container;

    // Icon mapping (from the icons object defined at the top of main.js)
    const iconMap = {
      "@": "debt",
      "^": "potion",
      "%": "vp",
      "#": "vp-token",
      $: "coin",
      "§": "custom-icon",
    };

    // Pattern to find icon symbols with optional numbers
    const pat = RegExp("([" + Object.keys(iconMap).join("").replace("$", "\\$") + "])(\\d*[*+]?)", "g");

    let lastIndex = 0;
    let match;
    while ((match = pat.exec(price)) !== null) {
      // Add text before this match
      if (match.index > lastIndex) {
        const textBefore = price.slice(lastIndex, match.index);
        const span = document.createElement("span");
        span.textContent = textBefore;
        container.appendChild(span);
      }

      const symbolChar = match[1];
      const suffix = match[2] || "";

      const iconClass = iconMap[symbolChar];
      if (iconClass) {
        const iconDiv = document.createElement("div");
        iconDiv.className = "cost-icon " + iconClass;

        // Show number inside icon
        const value = suffix;
        if (value) {
          const span = document.createElement("span");
          span.textContent = value;
          iconDiv.appendChild(span);
        }

        container.appendChild(iconDiv);
      }

      lastIndex = pat.lastIndex;
    }

    // Add remaining text after last match
    if (lastIndex < price.length) {
      const textAfter = price.slice(lastIndex);
      const span = document.createElement("span");
      span.textContent = textAfter;
      container.appendChild(span);
    }

    // fallback for plain text if no icons found
    if (!container.hasChildNodes() && price.trim()) {
      const span = document.createElement("span");
      span.textContent = price;
      container.appendChild(span);
    }

    return container;
  };

  // Render text with icon replacements (for descriptions)
  const renderTextWithIcons = (text) => {
    const container = document.createElement("span");
    if (!text) return container;

    const iconMap = {
      "@": "debt",
      "^": "potion",
      "%": "vp",
      "#": "vp-token",
      $: "coin",
      "§": "custom-icon",
    };

    const pat = RegExp("([" + Object.keys(iconMap).join("").replace("$", "\\$") + "])(\\d*[*+]?)", "g");

    let lastIndex = 0;
    let match;
    while ((match = pat.exec(text)) !== null) {
      if (match.index > lastIndex) {
        container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const symbolChar = match[1];
      const suffix = match[2] || "";
      const iconClass = iconMap[symbolChar];

      if (iconClass) {
        const iconSpan = document.createElement("span");
        iconSpan.className = "cost-icon inline " + iconClass;
        if (suffix) {
          const valueSpan = document.createElement("span");
          valueSpan.textContent = suffix;
          iconSpan.appendChild(valueSpan);
        }
        container.appendChild(iconSpan);
      }

      lastIndex = pat.lastIndex;
    }

    if (lastIndex < text.length) {
      container.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    return container;
  };

  this.export = async function () {
    // Get filtered data from DB based on current search term and official toggle
    const filteredData = await getFilteredData();

    if (filteredData.length === 0) {
      await showAlert("エクスポートするカードがありません。");
      return;
    }

    let jsonData = JSON.stringify(filteredData);
    download(jsonData, "dominion-card-generator-favorites.json", "text/plain");

    function download(content, fileName, contentType) {
      let a = document.createElement("a");
      let file = new Blob([content], {
        type: contentType,
      });
      a.href = URL.createObjectURL(file);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  this.exportPDF = async function () {
    const pdfBtn = document.getElementById("pdf-export-btn");

    // Check if jsPDF is loaded (before queueing)
    let jsPDF;
    if (window.jspdf && window.jspdf.jsPDF) {
      jsPDF = window.jspdf.jsPDF;
    } else if (window.jsPDF) {
      jsPDF = window.jsPDF;
    } else {
      console.error("jsPDF not found. window.jspdf:", window.jspdf, "window.jsPDF:", window.jsPDF);
      await showAlert("PDFライブラリの読み込みに失敗しました。ページを再読み込みしてください。");
      return;
    }

    // Collect card data before queueing (to capture current state)
    const filteredData = await getFilteredData();
    if (filteredData.length === 0) {
      await showAlert("出力するカードがありません。");
      if (pdfBtn) pdfBtn.disabled = false;
      return;
    }

    // Collect card IDs and calculate total deck size
    const cardIds = [];
    let totalDeckSize = 0;
    for (const cardData of filteredData) {
      const q = CardDatabase.getData(cardData);
      const size = q.size || "0";
      const isLandscape = size === "1";
      const isMat = size === "5";
      let deckSize;
      if (size === "4" || size === "5") {
        deckSize = parseInt(q.deckSize) || DEFAULT_DECK_SIZE_SINGLE;
      } else if (size === "1") {
        deckSize = parseInt(q.deckSize) || DEFAULT_DECK_SIZE_LANDSCAPE;
      } else {
        deckSize = parseInt(q.deckSize) || DEFAULT_DECK_SIZE;
      }
      totalDeckSize += deckSize;
      cardIds.push({ id: cardData.id, isLandscape, isMat, deckSize });
    }

    // Limit PDF export to 500 cards (by total deck size) due to heavy processing
    const PDF_MAX_CARDS = 500;
    if (totalDeckSize > PDF_MAX_CARDS) {
      await showAlert(`PDF出力は合計デッキ枚数が${PDF_MAX_CARDS}枚以下に制限されています。\n現在${totalDeckSize}枚選択されています。\n検索フィルターで絞り込んでください。`);
      if (pdfBtn) pdfBtn.disabled = false;
      return;
    }

    await backgroundProcessQueue.add("PDF出力", totalDeckSize, async (progress) => {
      try {
        let completedDeckSize = 0;
        const updateProgress = (deckSize) => {
          completedDeckSize += deckSize;
          progress.update(completedDeckSize, `${completedDeckSize} / ${totalDeckSize} 枚`);
        };

        // Create multiple iframes for parallel processing
        const workerCount = Math.min(PARALLEL_WORKERS, cardIds.length);
        const iframes = [];

        for (let w = 0; w < workerCount; w++) {
          const iframe = document.createElement("iframe");
          iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1600px;height:2400px;visibility:hidden;";
          document.body.appendChild(iframe);
          iframes.push(iframe);
        }

        // Wait for all iframes to load
        await Promise.all(
          iframes.map(
            (iframe) =>
              new Promise((resolve) => {
                iframe.onload = resolve;
                iframe.src = location.pathname + "?_iframe=1";
              }),
          ),
        );

        // Helper function to render card in a specific iframe
        const renderCardInIframe = (iframe, cardData, cardInfo) => {
          return new Promise((resolve) => {
            const iframeWindow = iframe.contentWindow;
            const iframeDoc = iframe.contentDocument;

            // Wait for iframe's myFavorites to be ready
            const waitForReady = () => {
              if (iframeWindow.applyQueryParams && iframeWindow.myFavorites) {
                // Load images into iframe's images array
                const loadImagesInIframe = async () => {
                  const iframeImages = iframeWindow.images;
                  const customIconIndex = iframeImages.length - 1;

                  const loadImage = (id, src) => {
                    return new Promise((res) => {
                      if (!src) {
                        iframeImages[id] = new Image();
                        res();
                        return;
                      }

                      const newImg = new Image();
                      let resolved = false;
                      const done = () => {
                        if (!resolved) {
                          resolved = true;
                          iframeImages[id] = newImg;
                          res();
                        }
                      };

                      newImg.onload = done;
                      newImg.onerror = done;
                      newImg.crossOrigin = "Anonymous";
                      if (src.substr(0, 11) !== "data:image/" && src.substr(0, 8) !== "file:///") {
                        newImg.src = CORS_ANYWHERE_BASE_URL + src;
                      } else {
                        newImg.src = src;
                      }
                      setTimeout(done, 2000);
                    });
                  };

                  const data = CardDatabase.getData(cardData);
                  const pictureUrl = data.picture || data["picture"];
                  const expansionUrl = data.expansion || data["expansion"];
                  const customIconUrl = data.customIcon || data["custom-icon"];
                  const illustrationSrc = cardData.images?.illustration || (pictureUrl && pictureUrl !== "[local image]" ? pictureUrl : null);
                  const expansionSrc = cardData.images?.expansion || (expansionUrl && expansionUrl !== "[local image]" ? expansionUrl : null);
                  const customIconSrc = cardData.images?.customIcon || (customIconUrl && customIconUrl !== "[local image]" ? customIconUrl : null);

                  await Promise.all([loadImage(5, illustrationSrc), loadImage(17, expansionSrc), loadImage(customIconIndex, customIconSrc)]);

                  if (iframeWindow.showLoadingState) {
                    iframeWindow.showLoadingState();
                  }

                  const params = new URLSearchParams(CardDatabase.getParams(cardData));
                  params.set("picture", "[iframe]");
                  params.set("expansion", "[iframe]");
                  params.set("custom-icon", "[iframe]");
                  iframeWindow.applyQueryParams("?" + params.toString());

                  const waitForRender = () => {
                    return new Promise((res) => {
                      const check = () => {
                        const canvasWrapper = iframeDoc.querySelector(".canvas-wrapper");
                        if (canvasWrapper && !canvasWrapper.hasAttribute("data-status")) {
                          setTimeout(res, 500);
                        } else {
                          setTimeout(check, 100);
                        }
                      };
                      setTimeout(check, 100);
                    });
                  };

                  await waitForRender();

                  const canvases = iframeDoc.getElementsByClassName("myCanvas");
                  let canvasIndex = 0;
                  if (cardInfo.isMat) canvasIndex = 2;
                  else if (cardInfo.isLandscape) canvasIndex = 1;

                  const canvas = canvases[canvasIndex];
                  if (canvas) {
                    try {
                      const dataUrl = canvas.toDataURL("image/png");
                      resolve(dataUrl);
                    } catch (e) {
                      console.error("Failed to capture canvas:", e);
                      resolve(null);
                    }
                  } else {
                    resolve(null);
                  }
                };

                loadImagesInIframe();
              } else {
                setTimeout(waitForReady, 100);
              }
            };
            waitForReady();
          });
        };

        // Process cards in parallel using worker pool
        const totalCards = cardIds.length;
        const results = new Array(totalCards);
        let nextIndex = 0;

        const processNext = async (workerIndex) => {
          while (nextIndex < totalCards) {
            const currentIndex = nextIndex++;
            const cardInfo = cardIds[currentIndex];
            const cardData = await db.get(cardInfo.id);

            if (cardData) {
              const dataUrl = await renderCardInIframe(iframes[workerIndex], cardData, cardInfo);
              results[currentIndex] = { dataUrl, cardData, cardInfo };
            } else {
              results[currentIndex] = null;
            }

            updateProgress(cardInfo.deckSize);
          }
        };

        // Start all workers
        await Promise.all(iframes.map((_, index) => processNext(index)));

        // Collect card images in order
        const cardImages = [];
        for (const result of results) {
          if (result && result.dataUrl) {
            const q = CardDatabase.getData(result.cardData);
            const size = q.size || "0";
            let repeatCount;
            if (size === "4" || size === "5") {
              repeatCount = parseInt(q.deckSize) || DEFAULT_DECK_SIZE_SINGLE;
            } else if (size === "1") {
              repeatCount = parseInt(q.deckSize) || DEFAULT_DECK_SIZE_LANDSCAPE;
            } else {
              repeatCount = parseInt(q.deckSize) || DEFAULT_DECK_SIZE;
            }

            for (let r = 0; r < repeatCount; r++) {
              cardImages.push({
                src: result.dataUrl,
                isLandscape: result.cardInfo.isLandscape,
                isMat: result.cardInfo.isMat,
              });
            }
          }
        }

        // Remove all iframes
        iframes.forEach((iframe) => document.body.removeChild(iframe));

        if (cardImages.length === 0) {
          progress.close();
          await showAlert("画像の取得に失敗しました。");
          return;
        }

        progress.update(totalCards, "PDF生成中...");

        // Helper function to rotate image 90 degrees clockwise
        const rotateImage90 = (dataUrl) => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              // Swap width and height for 90 degree rotation
              canvas.width = img.height;
              canvas.height = img.width;
              const ctx = canvas.getContext("2d");
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate(Math.PI / 2);
              ctx.drawImage(img, -img.width / 2, -img.height / 2);
              resolve(canvas.toDataURL("image/png"));
            };
            img.src = dataUrl;
          });
        };

        // Rotate landscape card images
        for (let i = 0; i < cardImages.length; i++) {
          if (cardImages[i].isLandscape) {
            cardImages[i].src = await rotateImage90(cardImages[i].src);
          }
        }

        // Create PDF (A4 size in mm: 210 x 297)
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        const pageWidth = 210;
        const pageHeight = 297;

        // Card size in mm (59mm x 91mm for 9 cards per page in 3x3 grid)
        const cardWidth = 59;
        const cardHeight = 91;
        // Mat scaled proportionally (doubled)
        const scale = 59 / 1403;
        const matWidth = Math.round(928 * scale * 2 * 10) / 10;
        const matHeight = Math.round(684 * (91 / 2151) * 2 * 10) / 10;

        // Minimal spacing for 9 cards per page (3x3)
        const cols = 3;
        const rows = 3;
        const spacing = 2;
        const marginX = (pageWidth - (cardWidth * cols + spacing * (cols - 1))) / 2;
        const marginY = (pageHeight - (cardHeight * rows + spacing * (rows - 1))) / 2;

        let col = 0;
        let row = 0;

        for (let i = 0; i < cardImages.length; i++) {
          const cardData = cardImages[i];
          let w, h;

          if (cardData.isMat) {
            w = matWidth;
            h = matHeight;
          } else {
            // Both portrait and landscape cards use same size (landscape is rotated to portrait)
            w = cardWidth;
            h = cardHeight;
          }

          // Calculate position
          const x = marginX + col * (cardWidth + spacing);
          const y = marginY + row * (cardHeight + spacing);

          // Add image to PDF
          try {
            pdf.addImage(cardData.src, "PNG", x, y, w, h);
          } catch (e) {
            console.error("Failed to add image:", e);
          }

          // Move to next position
          col++;
          if (col >= cols) {
            col = 0;
            row++;
            if (row >= rows) {
              row = 0;
              // Add new page if there are more cards
              if (i < cardImages.length - 1) {
                pdf.addPage();
              }
            }
          }
        }

        // Remove progress indicator
        progress.close();

        // Detect iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        if (isIOS) {
          // iOS: Download directly since blob URLs don't work well
          const timestamp = new Date().toISOString().slice(0, 10);
          const filename = `dominion-cards-${timestamp}.pdf`;
          pdf.save(filename);
        } else {
          // PC/Android: Open in new tab
          const pdfBlob = pdf.output("blob");
          const blobUrl = URL.createObjectURL(pdfBlob);
          window.open(blobUrl, "_blank");

          // Clean up blob URL after a delay
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        }
      } catch (error) {
        console.error("PDF export error:", error);
        // Remove progress indicator if exists
        if (typeof progress !== "undefined" && progress) progress.close();
        await showAlert("PDF出力中にエラーが発生しました: " + error.message);
      }
    });
  };

  // Sanitize filename - remove characters not allowed in filenames
  const sanitizeFilename = (name) => {
    if (!name) return "";
    // Remove characters not allowed in Windows/Mac/Linux filenames
    return name
      .replace(/[\/\\:*?"<>|]/g, "")
      .replace(/^\s+|\s+$/g, "")
      .replace(/^\.+|\.+$/g, "");
  };

  this.exportImages = async function () {
    const exportBtn = document.getElementById("images-export-btn");
    if (exportBtn) exportBtn.disabled = true;

    // Collect card data before queueing (to capture current state)
    const filteredData = await getFilteredData();
    if (filteredData.length === 0) {
      await showAlert("出力するカードがありません");
      if (exportBtn) exportBtn.disabled = false;
      return;
    }

    const cardIds = filteredData.map((item) => item.id);

    await backgroundProcessQueue.add("画像ダウンロード", cardIds.length, async (progress) => {
      try {
        const updateProgress = (current, total) => {
          progress.update(current, `${current} / ${total}`);
        };

        // Create multiple iframes for parallel processing
        const workerCount = Math.min(PARALLEL_WORKERS, cardIds.length);
        const iframes = [];

        for (let w = 0; w < workerCount; w++) {
          const iframe = document.createElement("iframe");
          iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1600px;height:2400px;visibility:hidden;";
          document.body.appendChild(iframe);
          iframes.push(iframe);
        }

        // Wait for all iframes to load
        await Promise.all(
          iframes.map(
            (iframe) =>
              new Promise((resolve) => {
                iframe.onload = resolve;
                iframe.src = location.pathname + "?_iframe=1";
              }),
          ),
        );

        // Helper function to render card in iframe
        const renderCardInIframe = (iframe, cardData) => {
          return new Promise((resolve) => {
            const iframeWindow = iframe.contentWindow;
            const iframeDoc = iframe.contentDocument;

            const waitForReady = () => {
              if (iframeWindow.applyQueryParams && iframeWindow.myFavorites) {
                const loadImagesInIframe = async () => {
                  const iframeImages = iframeWindow.images;
                  const customIconIndex = iframeImages.length - 1;

                  const loadImage = (id, src) => {
                    return new Promise((res) => {
                      if (!src) {
                        // Reset to default image
                        iframeImages[id] = new Image();
                        res();
                        return;
                      }

                      const newImg = new Image();
                      let resolved = false;
                      const done = () => {
                        if (!resolved) {
                          resolved = true;
                          iframeImages[id] = newImg;
                          res();
                        }
                      };

                      newImg.onload = done;
                      newImg.onerror = done;
                      newImg.crossOrigin = "Anonymous";
                      // Use CORS proxy for external URLs (not base64 or file://)
                      if (src.substr(0, 11) !== "data:image/" && src.substr(0, 8) !== "file:///") {
                        newImg.src = CORS_ANYWHERE_BASE_URL + src;
                      } else {
                        newImg.src = src;
                      }
                      setTimeout(done, 2000);
                    });
                  };

                  // Determine image sources - use base64 from images object, or fallback to external URLs
                  const data = CardDatabase.getData(cardData);
                  const pictureUrl = data.picture || data["picture"];
                  const expansionUrl = data.expansion || data["expansion"];
                  const customIconUrl = data.customIcon || data["custom-icon"];
                  const illustrationSrc = cardData.images?.illustration || (pictureUrl && pictureUrl !== "[local image]" ? pictureUrl : null);
                  const expansionSrc = cardData.images?.expansion || (expansionUrl && expansionUrl !== "[local image]" ? expansionUrl : null);
                  const customIconSrc = cardData.images?.customIcon || (customIconUrl && customIconUrl !== "[local image]" ? customIconUrl : null);

                  await Promise.all([loadImage(5, illustrationSrc), loadImage(17, expansionSrc), loadImage(customIconIndex, customIconSrc)]);

                  // Set loading state before applying params to ensure data-status is set
                  if (iframeWindow.showLoadingState) {
                    iframeWindow.showLoadingState();
                  }

                  // Apply params (use [iframe] placeholder for image fields to prevent clearing)
                  const params = new URLSearchParams(CardDatabase.getParams(cardData));
                  // Set placeholder to prevent applyQueryParams from clearing loaded images
                  params.set("picture", "[iframe]");
                  params.set("expansion", "[iframe]");
                  params.set("custom-icon", "[iframe]");
                  iframeWindow.applyQueryParams("?" + params.toString());

                  // Wait for rendering
                  const waitForRender = () => {
                    return new Promise((res) => {
                      const check = () => {
                        const canvasWrapper = iframeDoc.querySelector(".canvas-wrapper");
                        if (canvasWrapper && !canvasWrapper.hasAttribute("data-status")) {
                          setTimeout(res, 500);
                        } else {
                          setTimeout(check, 100);
                        }
                      };
                      setTimeout(check, 100);
                    });
                  };

                  await waitForRender();

                  // Get size from params
                  const q = CardDatabase.getData(cardData);
                  const size = q.size || "0";
                  const isMat = size === "5";
                  const isLandscape = size === "1" || size === "4";

                  // Capture canvas
                  const canvases = iframeDoc.getElementsByClassName("myCanvas");
                  let canvasIndex = 0;
                  if (isMat) canvasIndex = 2;
                  else if (isLandscape) canvasIndex = 1;

                  const canvas = canvases[canvasIndex];
                  if (canvas) {
                    try {
                      const dataUrl = canvas.toDataURL("image/png");
                      resolve({ dataUrl, data: q });
                    } catch (e) {
                      console.error("Failed to capture canvas:", e);
                      resolve(null);
                    }
                  } else {
                    resolve(null);
                  }
                };

                loadImagesInIframe();
              } else {
                setTimeout(waitForReady, 100);
              }
            };
            waitForReady();
          });
        };

        // Create ZIP file
        const zip = new JSZip();
        const usedFilenames = new Set();

        // Parallel processing with worker pool
        const totalCards = cardIds.length;
        const results = new Array(totalCards);
        let nextIndex = 0;
        let completedCount = 0;

        const processNext = async (workerIndex) => {
          while (nextIndex < totalCards) {
            const currentIndex = nextIndex++;
            const cardId = cardIds[currentIndex];
            const cardData = await db.get(cardId);

            if (cardData) {
              const result = await renderCardInIframe(iframes[workerIndex], cardData);
              results[currentIndex] = result;
            } else {
              results[currentIndex] = null;
            }

            completedCount++;
            updateProgress(completedCount, totalCards);
          }
        };

        // Start all workers
        await Promise.all(iframes.map((_, index) => processNext(index)));

        // Add results to ZIP in order
        for (const result of results) {
          if (result) {
            // Generate filename
            const expansionName = sanitizeFilename(result.data.expansionName || "");
            const cardName = sanitizeFilename(result.data.title || "card");
            let baseFilename;
            if (expansionName) {
              baseFilename = `${expansionName}_${cardName}`;
            } else {
              baseFilename = cardName;
            }

            // Ensure unique filename
            let filename = `${baseFilename}.png`;
            let counter = 1;
            while (usedFilenames.has(filename)) {
              filename = `${baseFilename}_${counter}.png`;
              counter++;
            }
            usedFilenames.add(filename);

            // Convert data URL to binary and add to ZIP
            const base64Data = result.dataUrl.split(",")[1];
            zip.file(filename, base64Data, { base64: true });
          }
        }

        // Clean up iframes
        iframes.forEach((iframe) => document.body.removeChild(iframe));

        // Generate and download ZIP
        progress.setTitle("ZIPを作成中...");
        const zipBlob = await zip.generateAsync({ type: "blob" });

        const timestamp = new Date().toISOString().slice(0, 10);
        const zipFilename = `dominion-cards-${timestamp}.zip`;

        const link = document.createElement("a");
        link.download = zipFilename;
        link.href = URL.createObjectURL(zipBlob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        // Clean up
        progress.close();

        if (exportBtn) exportBtn.disabled = false;
      } catch (error) {
        console.error("Image export error:", error);
        if (typeof progress !== "undefined" && progress) progress.close();
        // Clean up all iframes
        document.querySelectorAll("iframe[style*='-9999px']").forEach((iframe) => {
          document.body.removeChild(iframe);
        });
        if (exportBtn) exportBtn.disabled = false;
        await showAlert("画像出力中にエラーが発生しました: " + error.message);
      }
    });
  };

  this.import = function () {
    let myFavs = this;

    let inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json";

    inp.onchange = async (e) => {
      let file = e.target.files[0];
      const fileName = file.name;
      let reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = async (readerEvent) => {
        let content = readerEvent.target.result;
        let parsed = JSON.parse(content);
        // Support both new format {updated_at, cards} and old format (array)
        let newData = Array.isArray(parsed) ? parsed : parsed.cards;
        if (!Array.isArray(newData) || newData.length === 0) {
          await showAlert("インポートするデータがありません。");
          return;
        }

        await backgroundProcessQueue.add(`${fileName}のインポート`, newData.length, async (progress) => {
          const updateProgress = (current, total) => {
            progress.update(current, `${current} / ${total}`);
          };

          // Create multiple iframes for parallel processing
          const workerCount = Math.min(PARALLEL_WORKERS, newData.length);
          const iframes = [];

          for (let w = 0; w < workerCount; w++) {
            const iframe = document.createElement("iframe");
            iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1600px;height:2400px;visibility:hidden;";
            document.body.appendChild(iframe);
            iframes.push(iframe);
          }

          try {
            // Wait for all iframes to load
            await Promise.all(
              iframes.map(
                (iframe) =>
                  new Promise((resolve) => {
                    iframe.onload = resolve;
                    iframe.src = location.pathname + "?_iframe=1";
                  }),
              ),
            );

            // Wait for all iframes to be ready
            await Promise.all(
              iframes.map(
                (iframe) =>
                  new Promise((resolve) => {
                    const waitForReady = () => {
                      if (iframe.contentWindow.applyQueryParams && iframe.contentWindow.images) {
                        resolve();
                      } else {
                        setTimeout(waitForReady, 100);
                      }
                    };
                    waitForReady();
                  }),
              ),
            );

            // Helper function to render card in iframe and generate thumbnail
            const renderCardInIframe = (iframe, item) => {
              return new Promise((resolve) => {
                const iframeWindow = iframe.contentWindow;
                const iframeDoc = iframe.contentDocument;

                const cardData = CardDatabase.getData(item);
                const params = CardDatabase.getParams(item);

                // Load images into iframe
                const iframeImages = iframeWindow.images;
                const customIconIndex = iframeImages.length - 1;

                const loadImage = (id, src) => {
                  return new Promise((res) => {
                    const newImg = new Image();
                    let resolved = false;
                    const done = () => {
                      if (!resolved) {
                        resolved = true;
                        iframeImages[id] = newImg;
                        res();
                      }
                    };

                    if (src) {
                      newImg.onload = done;
                      newImg.onerror = done;
                      newImg.crossOrigin = "Anonymous";
                      // Use proxy for external URLs (not base64 or file://)
                      if (src.substr(0, 11) !== "data:image/" && src.substr(0, 8) !== "file:///") {
                        newImg.src = CORS_ANYWHERE_BASE_URL + src;
                      } else {
                        newImg.src = src;
                      }
                      setTimeout(done, 8000);
                    } else {
                      done();
                    }
                  });
                };

                // Determine image sources - use base64 from images object, or fallback to external URLs from cardData
                const illustrationSrc = item.images?.illustration || (cardData.picture && cardData.picture !== "[local image]" ? cardData.picture : null);
                const expansionSrc = item.images?.expansion || (cardData.expansion && cardData.expansion !== "[local image]" ? cardData.expansion : null);
                const customIconSrc = item.images?.customIcon || (cardData.customIcon && cardData.customIcon !== "[local image]" ? cardData.customIcon : null);

                const doRender = async () => {
                  await Promise.all([loadImage(5, illustrationSrc), loadImage(17, expansionSrc), loadImage(customIconIndex, customIconSrc)]);

                  // Set loading state before applying params to ensure data-status is set
                  if (iframeWindow.showLoadingState) {
                    iframeWindow.showLoadingState();
                  }

                  // Apply params (use [iframe] placeholder for image fields to prevent clearing)
                  const paramsForRender = new URLSearchParams(params);
                  // Set placeholder to prevent applyQueryParams from clearing loaded images
                  paramsForRender.set("picture", "[iframe]");
                  paramsForRender.set("expansion", "[iframe]");
                  paramsForRender.set("custom-icon", "[iframe]");
                  iframeWindow.applyQueryParams("?" + paramsForRender.toString());

                  // Wait for rendering
                  await new Promise((res) => {
                    const check = () => {
                      const canvasWrapper = iframeDoc.querySelector(".canvas-wrapper");
                      if (canvasWrapper && !canvasWrapper.hasAttribute("data-status")) {
                        setTimeout(res, 500);
                      } else {
                        setTimeout(check, 100);
                      }
                    };
                    setTimeout(check, 100);
                  });

                  // Generate thumbnail from iframe canvas
                  const size = cardData.size || "0";
                  const isMat = size === "5";
                  const isLandscape = size === "1" || size === "4";

                  const canvases = iframeDoc.getElementsByClassName("myCanvas");
                  let canvasIndex = 0;
                  if (isMat) canvasIndex = 2;
                  else if (isLandscape) canvasIndex = 1;

                  const canvas = canvases[canvasIndex];
                  let thumbnail = null;

                  if (canvas) {
                    try {
                      const maxSize = 800;
                      const thumbCanvas = document.createElement("canvas");
                      const ctx = thumbCanvas.getContext("2d");

                      if (isLandscape) {
                        const scale = Math.min(maxSize / canvas.height, maxSize / canvas.width);
                        thumbCanvas.width = canvas.height * scale;
                        thumbCanvas.height = canvas.width * scale;
                        ctx.translate(thumbCanvas.width / 2, thumbCanvas.height / 2);
                        ctx.rotate(Math.PI / 2);
                        ctx.drawImage(canvas, -thumbCanvas.height / 2, -thumbCanvas.width / 2, thumbCanvas.height, thumbCanvas.width);
                      } else {
                        const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height);
                        thumbCanvas.width = canvas.width * scale;
                        thumbCanvas.height = canvas.height * scale;
                        ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
                      }

                      thumbnail = thumbCanvas.toDataURL("image/png", 0.8);
                    } catch (e) {
                      console.warn("Failed to generate thumbnail:", e);
                    }
                  }

                  resolve({ thumbnail, cardData });
                };

                doRender();
              });
            };

            // Parallel processing with worker pool
            const totalItems = newData.length;
            const results = new Array(totalItems);
            let nextIndex = 0;
            let completedCount = 0;

            const processNext = async (workerIndex) => {
              while (nextIndex < totalItems) {
                const currentIndex = nextIndex++;
                const item = newData[currentIndex];
                delete item.id;

                const result = await renderCardInIframe(iframes[workerIndex], item);
                results[currentIndex] = { item, ...result };

                completedCount++;
                updateProgress(completedCount, totalItems);
              }
            };

            // Start all workers
            await Promise.all(iframes.map((_, index) => processNext(index)));

            // Get existing data for duplicate checking
            const existingData = await db.getAll();

            let addedCount = 0;
            let updatedCount = 0;

            // Process database operations sequentially to avoid race conditions
            for (let i = 0; i < results.length; i++) {
              const { item, thumbnail, cardData } = results[i];

              item.timestamp = item.timestamp || Date.now();
              // Preserve official flag from imported data (now in data object), default to false
              if (item.data && item.data.official === undefined) item.data.official = false;

              // Check for existing card with same title and expansion name
              // Helper to normalize title (remove trailing *)
              const normalizeTitle = (title) => title.replace(/\*+$/, "");

              const itemTitle = normalizeTitle((cardData.title || "").trim());
              const itemExpansion = (cardData.expansionName || "").trim();
              let existingMatch = null;

              for (const existing of existingData) {
                const existingCardData = CardDatabase.getData(existing);
                const existingTitle = normalizeTitle((existingCardData.title || "").trim());
                const existingExpansion = (existingCardData.expansionName || "").trim();

                if (existingTitle === itemTitle && existingExpansion === itemExpansion) {
                  existingMatch = existing;
                  break;
                }
              }

              if (existingMatch) {
                // Update existing card
                item.id = existingMatch.id;
                await db.update(item);

                // Handle thumbnail for existing card using card ID
                if (thumbnail) {
                  await db.saveThumbnail(existingMatch.id, thumbnail);
                }

                // Update existingData array to reflect the change
                const idx = existingData.findIndex((e) => e.id === existingMatch.id);
                if (idx !== -1) existingData[idx] = item;
                updatedCount++;
              } else {
                // Add new card
                const newId = await db.add(item);
                item.id = newId;

                // Save thumbnail to separate store using card ID
                if (thumbnail) {
                  await db.saveThumbnail(newId, thumbnail);
                }

                existingData.push(item);
                addedCount++;
              }
            }

            // Clean up iframes
            iframes.forEach((iframe) => document.body.removeChild(iframe));
            progress.close();
            myFavs.refresh();

            // Build result message
            let message = "";
            if (addedCount > 0) message += `${addedCount}件を追加`;
            if (updatedCount > 0) {
              if (message) message += "、";
              message += `${updatedCount}件を上書き`;
            }
            message += "しました。";
            showToast(message);
          } catch (error) {
            console.error("Import error:", error);
            // Clean up all iframes
            iframes.forEach((iframe) => {
              if (iframe.parentNode) document.body.removeChild(iframe);
            });
            progress.close();
            await showAlert("インポート中にエラーが発生しました: " + error.message);
          }
        });
      };
    };
    inp.click();
  };

  this.open = function () {
    this.initViewMode();
    // Disconnect stale thumbnail observer and null it to prevent any pending
    // double-rAF callbacks from re-activating a stale observer
    if (thumbnailObserver) {
      thumbnailObserver.disconnect();
      thumbnailObserver = null;
    }
    thumbnailQueue = [];
    isProcessingThumbnailQueue = false;
    // Restore search term from localStorage
    const savedSearchTerm = localStorage.getItem("favoritesSearchTerm") || "";
    const searchInput = document.getElementById("favorites-search");
    if (searchInput) {
      searchInput.value = savedSearchTerm;
    }
    // Make modal visible first, then refresh with debounce (same flow as toggleView).
    // This ensures iOS WebKit has time to compute layout before the observer fires.
    // Clearing existing thumbnails prevents 882 stale compositing layers from
    // becoming active simultaneously when the modal appears.
    fav.classList.remove("hidden");
    if (window.innerWidth > 600) {
      document.getElementById("favorites-search").focus();
    } else {
      document.body.classList.add("no-scroll");
    }
    this.refresh();
  };
  this.close = function () {
    // Save scroll position before clearing DOM so it can be restored on reopen.
    // Skip if already saved by load() (which clears DOM before calling close()).
    if (savedScrollTop === 0) {
      const popupBody = fav.querySelector(".popup-body");
      if (popupBody) {
        savedScrollTop = popupBody.scrollTop;
      }
    }
    // Disconnect and null observer to invalidate any pending double-rAF callbacks
    if (thumbnailObserver) {
      thumbnailObserver.disconnect();
      thumbnailObserver = null;
    }
    thumbnailQueue = [];
    isProcessingThumbnailQueue = false;
    // Cancel any pending debounced refresh to prevent it from firing during
    // the close animation (where "hidden" class isn't set yet)
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer);
      refreshDebounceTimer = null;
    }
    // Clear thumbnail DOM to free decoded bitmap memory.
    // open() always calls this.refresh() which rebuilds from scratch.
    while (favThumbnails.firstChild) {
      favThumbnails.removeChild(favThumbnails.firstChild);
    }
    if (window.innerWidth <= 600) {
      // Prevent multiple closing animations
      if (fav.classList.contains("closing") || fav.classList.contains("hidden")) {
        return;
      }

      fav.classList.add("closing");

      // Use a named function for the event handler to ensure proper cleanup
      const handleAnimationEnd = () => {
        fav.classList.remove("closing");
        fav.classList.add("hidden");
        document.body.classList.remove("no-scroll");
      };

      // Add event listener with once option
      fav.addEventListener("animationend", handleAnimationEnd, { once: true });

      // Fallback timeout in case animationend doesn't fire (e.g., on some iOS versions)
      const fallbackTimeout = setTimeout(() => {
        // Remove the event listener manually
        fav.removeEventListener("animationend", handleAnimationEnd);
        handleAnimationEnd();
      }, 300); // 300ms matches the animation duration (0.2s animation + buffer)

      // Clear fallback timeout when animation actually ends
      fav.addEventListener(
        "animationend",
        () => {
          clearTimeout(fallbackTimeout);
        },
        { once: true },
      );
    } else {
      fav.classList.add("hidden");
      document.body.classList.remove("no-scroll");
    }
  };
  this.deleteAll = async function () {
    // Get filtered data from DB based on current search term and official toggle
    const filteredData = await getFilteredData();
    const visibleIds = filteredData.map((item) => item.id);

    if (visibleIds.length === 0) {
      await showAlert("削除するカードがありません。");
      return;
    }

    if (!(await showConfirm(`表示中の${visibleIds.length}件を削除してもよろしいですか？`))) return;

    // Collect source files of official cards being deleted
    const officialSourceFiles = new Set();
    for (const item of filteredData) {
      if (item.data?.official && item.data?.sourceFile) {
        officialSourceFiles.add(item.data.sourceFile);
      }
    }

    for (const id of visibleIds) {
      await db.delete(id);
    }

    // Reset timestamps for deleted official card sources
    if (officialSourceFiles.size > 0) {
      const storedTimestamps = JSON.parse(localStorage.getItem("officialCardsTimestamps") || "{}");
      for (const sourceFile of officialSourceFiles) {
        delete storedTimestamps[sourceFile];
      }
      localStorage.setItem("officialCardsTimestamps", JSON.stringify(storedTimestamps));
    }

    this.refresh();
  };
  this.delete = async function (id) {
    const card = await db.get(id);
    if (card) {
      const cardData = CardDatabase.getData(card);
      const title = cardData.title || "Untitled";
      if (!(await showConfirm(title + " を削除してもよろしいですか？"))) return;
      await db.delete(id);
      this.refresh();
    }
  };
  this.add = async function () {
    const data = CardDatabase.buildDataFromForm();
    data.official = false;
    // Only save images if the form field has a value
    const pictureField = document.getElementById("picture").value.trim();
    const expansionField = document.getElementById("expansion").value.trim();
    const customIconField = document.getElementById("custom-icon").value.trim();

    const card = {
      data: data,
      images: {
        illustration: pictureField ? await db.getLiveImage(5) : null,
        expansion: expansionField ? await db.getLiveImage(17) : null,
        customIcon: customIconField ? await db.getLiveImage(images.length - 1) : null,
      },
      timestamp: Date.now(),
    };
    const cardId = await db.add(card);

    // Generate and save thumbnail using card ID
    const thumbnailData = generateThumbnail(data.official);
    if (thumbnailData) {
      await db.saveThumbnail(cardId, thumbnailData);
    }

    this.refresh();
  };
  this.addOrUpdate = async function () {
    // Helper to normalize title (remove trailing *)
    const normalizeTitle = (title) => title.replace(/\*+$/, "");

    const currentTitle = normalizeTitle(document.getElementById("title").value.trim());
    const currentExpansion = document.getElementById("expansionName").value.trim();
    const all = await db.getAll();
    let match = null;

    for (const item of all) {
      const itemData = CardDatabase.getData(item);
      const itemTitle = normalizeTitle((itemData.title || "").trim());
      const itemExpansion = (itemData.expansionName || "").trim();

      if (itemTitle === currentTitle && itemExpansion === currentExpansion) {
        match = item;
        break;
      }
    }

    if (match) {
      await this.update(match.id);
    } else {
      await this.add();
      showToast("お気に入りに追加しました。");
    }
  };
  this.update = async function (id) {
    const existingCard = await db.get(id);
    const existingData = CardDatabase.getData(existingCard);
    const existingTitle = existingData.title || "Untitled";
    const newTitle = document.getElementById("title").value || "Untitled";

    if (existingCard && existingTitle !== newTitle) {
      if (!(await showConfirm("カード名を 「" + existingTitle + "」 から 「" + newTitle + "」 に変更して更新しますか？"))) return;
    }

    const data = CardDatabase.buildDataFromForm();
    data.official = existingCard?.data?.official || false;
    // Only save images if the form field has a value
    const pictureField = document.getElementById("picture").value.trim();
    const expansionField = document.getElementById("expansion").value.trim();
    const customIconField = document.getElementById("custom-icon").value.trim();

    const card = {
      id: id,
      data: data,
      images: {
        illustration: pictureField ? await db.getLiveImage(5) : null,
        expansion: expansionField ? await db.getLiveImage(17) : null,
        customIcon: customIconField ? await db.getLiveImage(images.length - 1) : null,
      },
      timestamp: Date.now(),
    };
    await db.update(card);

    // Generate and save/update thumbnail using card ID
    const thumbnailData = generateThumbnail(data.official);
    if (thumbnailData) {
      await db.saveThumbnail(id, thumbnailData);
    }

    this.refresh();
    showToast(newTitle + " を更新しました。");
  };
  this.load = async function (id) {
    // Save scroll position before clearing DOM
    const popupBody = fav.querySelector(".popup-body");
    if (popupBody) {
      savedScrollTop = popupBody.scrollTop;
    }
    // Stop thumbnail processing before heavy card rendering
    if (thumbnailObserver) {
      thumbnailObserver.disconnect();
      thumbnailObserver = null;
    }
    thumbnailQueue = [];
    isProcessingThumbnailQueue = false;

    // Clear thumbnail DOM to free decoded bitmap memory before heavy card rendering.
    // Without this, thumbnail images + full-size card images exceed iOS memory limits.
    while (favThumbnails.firstChild) {
      favThumbnails.removeChild(favThumbnails.firstChild);
    }

    const card = await db.get(id);
    if (card) {
      // Show loading state and clear previous preview
      window.showLoadingState();

      // Restore images to the live store for the main logic to pick up
      if (card.images.illustration) await db.saveLiveImage(5, card.images.illustration);
      else await db.deleteLiveImage(5);

      if (card.images.expansion) await db.saveLiveImage(17, card.images.expansion);
      else await db.deleteLiveImage(17);

      if (card.images.customIcon) await db.saveLiveImage(images.length - 1, card.images.customIcon);
      else await db.deleteLiveImage(images.length - 1);

      // Get params string (handles both old and new format)
      const params = CardDatabase.getParams(card);

      // Update URL without navigation
      history.pushState(null, "", location.pathname + params);

      // Apply parameters to update form fields
      window.applyQueryParams(params);

      // Load images into the view
      const cardData = CardDatabase.getData(card);
      if (card.images?.illustration) {
        window.setImageSource(5, card.images.illustration);
        document.getElementById("picture").value = "[local image]";
      } else if (cardData.picture && cardData.picture !== "[local image]") {
        // External URL - let the normal onchange handler load it
        document.getElementById("picture").value = cardData.picture;
        document.getElementById("picture").onchange();
      } else {
        window.clearImageSource(5);
        document.getElementById("picture").value = "";
      }

      if (card.images?.expansion) {
        window.setImageSource(17, card.images.expansion);
        document.getElementById("expansion").value = "[local image]";
      } else if (cardData.expansion && cardData.expansion !== "[local image]") {
        // External URL - let the normal onchange handler load it
        document.getElementById("expansion").value = cardData.expansion;
        document.getElementById("expansion").onchange();
      } else {
        window.clearImageSource(17);
        document.getElementById("expansion").value = "";
      }

      if (card.images?.customIcon) {
        window.setImageSource(images.length - 1, card.images.customIcon);
        document.getElementById("custom-icon").value = "[local image]";
      } else if (cardData.customIcon && cardData.customIcon !== "[local image]") {
        // External URL - let the normal onchange handler load it
        document.getElementById("custom-icon").value = cardData.customIcon;
        document.getElementById("custom-icon").onchange();
      } else {
        window.clearImageSource(images.length - 1);
        document.getElementById("custom-icon").value = "";
      }

      // Close the favorites modal
      this.close();
    }
  };
  this.sort = function () {
    // Simple sort for now, would be better to sort in DB or after fetch
    ascending = !ascending;
    this.refresh();
  };

  // Current search term
  var currentSearchTerm = localStorage.getItem("favoritesSearchTerm") || "";

  // Column name mapping for search
  const searchColumnMap = {
    拡張名: "expansion",
    拡張: "expansion",
    種類: "size",
    コスト: "price",
    カード名: "title",
    名前: "title",
    種別: "type",
    テキスト: "description",
    説明: "description",
  };

  // Split by spaces but keep quoted strings together
  const splitWithQuotes = (str) => {
    const tokens = [];
    let current = "";
    let inQuote = false;
    let quoteChar = null;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if ((char === '"' || char === "'" || char === '"' || char === '"' || char === "「" || char === "」") && !inQuote) {
        inQuote = true;
        quoteChar = char === "「" ? "」" : char === '"' ? '"' : char;
      } else if (inQuote && (char === quoteChar || (quoteChar === '"' && char === '"'))) {
        inQuote = false;
        quoteChar = null;
      } else if ((char === " " || char === "　") && !inQuote) {
        if (current.length > 0) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }
    if (current.length > 0) {
      tokens.push(current);
    }
    return tokens;
  };

  // Parse search keywords
  const parseSearchKeywords = (term) => {
    return splitWithQuotes(term)
      .filter((k) => k.length > 0)
      .map((k) => {
        let column = null;
        let exclude = false;
        let value = k;

        const firstColonIndex = value.indexOf(":");
        if (firstColonIndex > 0) {
          const firstPart = value.substring(0, firstColonIndex);
          const rest = value.substring(firstColonIndex + 1);

          if (firstPart === "除外") {
            exclude = true;
            value = rest;
          } else if (searchColumnMap[firstPart]) {
            column = searchColumnMap[firstPart];
            value = rest;

            const secondColonIndex = value.indexOf(":");
            if (secondColonIndex > 0) {
              const secondPart = value.substring(0, secondColonIndex);
              if (secondPart === "除外") {
                exclude = true;
                value = value.substring(secondColonIndex + 1);
              }
            }
          }
        }

        return { column: column, value: value.toUpperCase(), exclude: exclude };
      })
      .filter((k) => k.value.length > 0);
  };

  // Build search data from card data object
  const buildSearchDataFromCard = (q) => {
    const data = extractCardData(q);
    return {
      expansion: (data.expansion + (data.edition || "")).toUpperCase(),
      size: data.sizeText.toUpperCase(),
      price: data.price.toUpperCase(),
      title: data.fullTitle.toUpperCase(),
      type: data.fullType.toUpperCase(),
      description: data.description.toUpperCase(),
      all: [data.fullTitle, data.fullType, data.expansion, data.edition, data.sizeText, data.price, data.description].filter(Boolean).join(" ").toUpperCase(),
    };
  };

  // Check if card matches all keywords
  const cardMatchesKeywords = (item, parsedKeywords) => {
    if (parsedKeywords.length === 0) return true;

    const q = CardDatabase.getData(item);
    const searchData = buildSearchDataFromCard(q);

    return parsedKeywords.every((k) => {
      let matches;
      if (k.column) {
        matches = (searchData[k.column] || "").includes(k.value);
      } else {
        matches = searchData.all.includes(k.value);
      }
      return k.exclude ? !matches : matches;
    });
  };

  // Filter and sort data from DB
  const filterAndSortData = (allData, searchTerm) => {
    const parsedKeywords = parseSearchKeywords(searchTerm);

    // Filter by search keywords
    let filteredData = allData.filter((item) => cardMatchesKeywords(item, parsedKeywords));

    // Filter by official toggle
    if (!showOfficial) {
      filteredData = filteredData.filter((item) => !item.data?.official);
    }

    // Sort data
    return sortData(filteredData);
  };

  // Helper to get filtered data (for export, PDF, images, delete operations)
  const getFilteredData = async () => {
    const allData = await db.getAll();
    return filterAndSortData(allData, currentSearchTerm);
  };

  var searchDebounceTimer = null;
  const searchLoading = document.getElementById("favorites-search-loading");

  const showSearchLoading = () => {
    if (searchLoading) searchLoading.classList.remove("hidden");
    if (cardCountEl) cardCountEl.classList.add("hidden");
  };

  const hideSearchLoading = () => {
    if (searchLoading) searchLoading.classList.add("hidden");
    if (cardCountEl) cardCountEl.classList.remove("hidden");
  };

  this.search = function (term) {
    // Clear previous timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // Show loading immediately
    showSearchLoading();

    // Debounce: wait 200ms before searching
    searchDebounceTimer = setTimeout(async () => {
      searchDebounceTimer = null;
      // Save search term
      currentSearchTerm = term;
      localStorage.setItem("favoritesSearchTerm", term);

      // Refresh with new search term (immediate, no debounce since search already has debounce)
      await this.refreshImmediate();

      // Hide loading after refresh completes
      hideSearchLoading();
    }, 200);
  };

  // Helper: Convert size code to display text
  const getSizeText = (size) => {
    const sizeMap = {
      0: "カード",
      1: "ランドスケープ",
      2: "ダブル",
      3: "ベース",
      4: "マーカー",
      5: "マット",
    };
    return sizeMap[size] || "";
  };

  // Helper: Extract card data from data object
  const extractCardData = (q) => {
    const title = (q.title || "").trim() || "<名称未決定>";
    const title2 = (q.title2 || "").trim();
    const type = (q.type || "").trim();
    const type2 = (q.type2 || "").trim();
    const size = q.size || "0";
    const expansion = (q.expansionName || "").trim();
    const edition = (q.edition || "").trim();
    const isDeleted = edition.includes("【削除】");
    return {
      title,
      title2,
      fullTitle: title + (title2 ? " | " + title2 : ""),
      type,
      type2,
      fullType: type + (type2 ? " | " + type2 : ""),
      description: (q.description || "").trim(),
      price: (q.price || "").trim(),
      expansion,
      edition,
      isDeleted,
      size,
      sizeText: getSizeText(size),
      isLandscape: size === "1" || size === "4",
      isMat: size === "5",
    };
  };

  // Internal refresh implementation
  const doRefresh = async () => {
    // Thumbnails are stored in a separate store and loaded on-demand
    const allData = await db.getAll();
    // Filter and sort data based on current search term and settings
    const filteredData = filterAndSortData(allData, currentSearchTerm);

    // Update card count (exclude official cards from total when hidden)
    const totalCount = showOfficial ? allData.length : allData.filter((item) => !item.data?.official).length;
    updateCardCount(filteredData.length, totalCount);

    // Refresh both views
    while (favList.firstChild) {
      favList.removeChild(favList.firstChild);
    }

    // Also refresh thumbnails view
    await this.refreshThumbnails(filteredData);

    // Table Header
    const columns = [
      { label: "拡張名", key: "expansion", class: "expansion" },
      { label: "種類", key: "size", class: "size" },
      { label: "コスト", key: "cost", class: "cost" },
      { label: "カード名", key: "title", class: "title" },
      { label: "種別", key: "type", class: "type" },
      { label: "テキスト", key: "description", class: "description" },
    ];

    let thead = document.createElement("thead");
    let headerRow = document.createElement("tr");
    columns.forEach((col) => {
      let th = document.createElement("th");
      th.className = col.class;
      if (col.key) {
        th.style.cursor = "pointer";
        th.onclick = (e) => this.sortBy(col.key, e);

        // Add sort indicator if this column is being sorted
        const sortInfo = sortState.find((s) => s.column === col.key);
        if (sortInfo) {
          const indicator = sortInfo.direction === "asc" ? " ▲" : " ▼";
          th.appendChild(document.createTextNode(col.label + indicator));
        } else {
          th.appendChild(document.createTextNode(col.label));
        }
      } else {
        th.appendChild(document.createTextNode(col.label));
      }
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    favList.appendChild(thead);

    let tbody = document.createElement("tbody");
    favList.appendChild(tbody);

    // Setup floating actions mouseleave handler (only once)
    const floatingActions = document.getElementById("floating-row-actions");
    if (floatingActions && !floatingActions.hasAttribute("data-listener-added")) {
      floatingActions.setAttribute("data-listener-added", "true");
      floatingActions.addEventListener("mouseleave", () => {
        floatingActions.classList.remove("visible");
      });
    }

    filteredData.forEach((item) => {
      const params = CardDatabase.getParams(item);
      const q = CardDatabase.getData(item);
      const data = extractCardData(q);

      let tr = document.createElement("tr");
      tr.dataset.id = item.id;
      tr.dataset.official = item.data?.official ? "true" : "false";
      tr.onclick = () => this.load(item.id);

      if (params === document.location.search) {
        tr.className = data.isDeleted ? "active deleted" : "active";
      } else if (data.isDeleted) {
        tr.className = "deleted";
      }

      // 1. Expansion (with icon if available)
      let tdExp = document.createElement("td");
      tdExp.setAttribute("class", "expansion");
      // Check for saved image or external URL
      const expIconSrc = item.images?.expansion || (q.expansion && q.expansion !== "[local image]" ? q.expansion : null);
      if (expIconSrc) {
        const expIcon = document.createElement("img");
        // Use CORS proxy for external URLs
        if (expIconSrc.substr(0, 11) !== "data:image/") {
          expIcon.src = CORS_ANYWHERE_BASE_URL + expIconSrc;
        } else {
          expIcon.src = expIconSrc;
        }
        expIcon.className = "expansion-icon";
        expIcon.alt = "";
        // Pre-allocate space using remembered width per expansion
        const expansionKey = data.expansion;
        // Store expansion name for dark mode styling
        expIcon.dataset.expansion = expansionKey;
        if (rememberedIconWidths[expansionKey] > 0) {
          expIcon.style.minWidth = rememberedIconWidths[expansionKey] + "px";
        }
        // Update remembered width when image loads
        expIcon.onload = function () {
          const currentWidth = rememberedIconWidths[expansionKey] || 0;
          if (this.offsetWidth > currentWidth) {
            rememberedIconWidths[expansionKey] = this.offsetWidth;
            localStorage.setItem("favoritesIconWidths", JSON.stringify(rememberedIconWidths));
          }
          // Remove min-width after load to use actual width
          this.style.minWidth = "";
        };
        tdExp.appendChild(expIcon);
      }
      const expansionLabel = document.createElement("span");
      const shrinked = data.expansion.length > 5;
      if (shrinked) {
        expansionLabel.className = "expansion-label shrink";
      } else {
        expansionLabel.className = "expansion-label";
      }
      expansionLabel.textContent = data.expansion;
      tdExp.appendChild(expansionLabel);
      if (data.edition) {
        const editionLabel = document.createElement("span");
        editionLabel.className = "edition-label";
        editionLabel.textContent = data.edition;
        if (shrinked) {
          editionLabel.style.marginLeft = `-${(data.expansion.length - 5) * 2 - 0.2}em`;
        }
        if (data.edition.match(/【(収穫祭|ギルド)】【削除】/)) {
          editionLabel.textContent = "【削除】";
        }
        tdExp.appendChild(editionLabel);
      }
      tr.appendChild(tdExp);

      // 2. Size
      let tdSize = document.createElement("td");
      tdSize.setAttribute("class", "size");
      let sizeSpan = document.createElement("span");
      if (data.sizeText.length > 4) {
        sizeSpan.style.transform = `scale(${1 - 0.15 * (data.sizeText.length - 4)}, 1)`;
      }
      sizeSpan.appendChild(document.createTextNode(data.sizeText));
      tdSize.appendChild(sizeSpan);
      tr.appendChild(tdSize);

      // 3. Cost
      let tdCost = document.createElement("td");
      tdCost.setAttribute("class", "cost");
      tdCost.appendChild(renderCostIcons(data.price));
      tr.appendChild(tdCost);

      // 4. Card Name
      let tdTitle = document.createElement("td");
      tdTitle.setAttribute("class", "title");
      tdTitle.appendChild(document.createTextNode(data.fullTitle));
      tr.appendChild(tdTitle);

      // 5. Type
      let tdType = document.createElement("td");
      tdType.setAttribute("class", "type");

      let typeSpan = document.createElement("span");
      if (data.fullType.length > 12) {
        typeSpan.style.transform = `scale(${1 - 0.05 * (data.fullType.length - 12)}, 1)`;
      }
      typeSpan.appendChild(document.createTextNode(data.fullType));
      tdType.appendChild(typeSpan);

      tr.appendChild(tdType);

      // 6. Description
      let tdText = document.createElement("td");
      tdText.setAttribute("class", "description");

      let textSpan = document.createElement("span");
      textSpan.appendChild(renderCostIcons(data.description.replace(/\n/g, " ")));
      tdText.appendChild(textSpan);
      tr.appendChild(tdText);

      // Hover actions (hide for official cards)
      if (!item.data?.official) {
        let actions = document.createElement("div");
        actions.setAttribute("class", "row-actions");

        let bttnUpdate = document.createElement("button");
        bttnUpdate.setAttribute("class", "update");
        bttnUpdate.onclick = (e) => {
          e.stopPropagation();
          this.update(item.id);
        };
        bttnUpdate.appendChild(document.createTextNode("Update"));
        actions.appendChild(bttnUpdate);

        let bttnDel = document.createElement("button");
        bttnDel.setAttribute("class", "delete");
        bttnDel.onclick = (e) => {
          e.stopPropagation();
          this.delete(item.id);
        };
        bttnDel.appendChild(document.createTextNode("Delete"));
        actions.appendChild(bttnDel);

        // Floating actions (positioned via JS on hover)
        tr.addEventListener("mouseenter", (e) => {
          const floatingActions = document.getElementById("floating-row-actions");
          if (floatingActions) {
            floatingActions.innerHTML = "";
            floatingActions.appendChild(actions.cloneNode(true));
            floatingActions.querySelector(".update").onclick = (ev) => {
              ev.stopPropagation();
              this.update(item.id);
            };
            floatingActions.querySelector(".delete").onclick = (ev) => {
              ev.stopPropagation();
              this.delete(item.id);
            };
            const rect = tr.getBoundingClientRect();
            const containerRect = floatingActions.parentElement.getBoundingClientRect();
            floatingActions.style.top = rect.top - containerRect.top + floatingActions.parentElement.scrollTop + "px";
            floatingActions.classList.add("visible");
          }
        });
        tr.addEventListener("mouseleave", (e) => {
          const floatingActions = document.getElementById("floating-row-actions");
          if (floatingActions) {
            // Don't hide if mouse is moving to the floating actions
            if (e.relatedTarget && (e.relatedTarget === floatingActions || floatingActions.contains(e.relatedTarget))) {
              return;
            }
            floatingActions.classList.remove("visible");
          }
        });
      }

      tbody.appendChild(tr);
    });

    // Re-apply view mode after refresh
    this.applyViewMode();

    // Restore saved scroll position (from close/reopen cycle)
    if (savedScrollTop > 0) {
      const popupBody = fav.querySelector(".popup-body");
      if (popupBody) {
        popupBody.scrollTop = savedScrollTop;
        savedScrollTop = 0;
      }
    }
  };

  // Debounced refresh method
  this.refresh = function () {
    // Clear existing timer
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer);
    }

    // Set new timer
    refreshDebounceTimer = setTimeout(() => {
      doRefresh();
      refreshDebounceTimer = null;
    }, refreshDebounceDelay);
  };

  // Immediate refresh (bypass debounce)
  this.refreshImmediate = function () {
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer);
      refreshDebounceTimer = null;
    }
    return doRefresh();
  };

  // Process thumbnail rendering queue sequentially to prevent memory pressure on iOS
  const processThumbnailQueue = async () => {
    if (isProcessingThumbnailQueue) return;
    // Don't load thumbnails while modal is hidden - prevents loading all 882
    // thumbnails into memory during page startup when observer root is invisible
    if (fav.classList.contains("hidden")) return;
    isProcessingThumbnailQueue = true;
    try {
      while (thumbnailQueue.length > 0) {
        // Re-check modal visibility on each iteration
        if (fav.classList.contains("hidden")) break;
        const { card, item, data, params } = thumbnailQueue.shift();
        // Skip if already rendered, currently rendering, or removed from DOM
        if (card.dataset.rendered === "true" || card.dataset.rendering === "true" || !card.parentNode) continue;
        await renderThumbnailContent(card, item, data, params).catch((e) => {
          console.error("Failed to render thumbnail:", e);
          card.dataset.rendering = "false";
        });
        // Small delay on mobile between loads to allow GC and reduce memory pressure
        if (isMobile()) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    } finally {
      isProcessingThumbnailQueue = false;
    }
  };

  // Render thumbnail view
  // Render full content for a thumbnail card
  const renderThumbnailContent = async (card, item, data, params) => {
    const myFavs = this;

    // Check if already rendering to prevent duplicate calls
    if (card.dataset.rendering === "true") {
      return;
    }

    // Mark as rendering to prevent duplicate calls during async operations
    card.dataset.rendering = "true";

    try {
      // Show detailed placeholder with card info while loading
      renderDetailedPlaceholder(card, data);

      // Load thumbnail on-demand using card ID (detailed placeholder visible during load)
      let thumbnail = null;
      if (item.id) {
        try {
          thumbnail = await db.getThumbnail(item.id);
        } catch (e) {
          console.error("Failed to load thumbnail:", e);
          thumbnail = null;
        }
      }

      // Abort if modal was closed or card removed during async load
      if (fav.classList.contains("hidden") || !card.parentNode) {
        card.dataset.rendering = "false";
        return;
      }

      // Thumbnail image or keep placeholder with card info
      if (thumbnail) {
        card.innerHTML = "";
        const img = document.createElement("img");
        img.className = "thumbnail-image" + (data.isLandscape ? " landscape" : "") + (data.isMat ? " mat" : "");

        if (thumbnail.substr(0, 11) != "data:image/" && thumbnail.substr(0, 8) != "file:///") {
          img.src = CORS_ANYWHERE_BASE_URL + thumbnail;
        } else {
          // Convert base64 data URL to Object URL for explicit memory management.
          // iOS WebKit keeps decoded bitmaps of data URLs in cache indefinitely,
          // causing OOM crashes. Object URLs can be revoked to free memory.
          try {
            const res = await fetch(thumbnail);
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            img.onload = () => URL.revokeObjectURL(objectUrl);
            img.src = objectUrl;
          } catch (e) {
            img.src = thumbnail;
          }
        }
        // Abort if modal was closed during Object URL conversion
        if (fav.classList.contains("hidden")) {
          card.dataset.rendering = "false";
          return;
        }
        img.alt = data.title;
        card.appendChild(img);
      } else {
        // No thumbnail: detailed placeholder is already displayed, keep it
      }

      // Action buttons (hide for official cards)
      if (!item.data?.official) {
        const actions = document.createElement("div");
        actions.className = "thumbnail-actions";

        const updateBtn = document.createElement("button");
        updateBtn.className = "update";
        updateBtn.textContent = "Update";
        updateBtn.onclick = (e) => {
          e.stopPropagation();
          myFavs.update(item.id);
        };
        actions.appendChild(updateBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete";
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          myFavs.delete(item.id);
        };
        actions.appendChild(deleteBtn);

        card.appendChild(actions);
      }

      // Mark as rendered and clear rendering flag
      card.dataset.rendering = "false";
      card.dataset.rendered = "true";
    } catch (error) {
      console.error("Error rendering thumbnail content:", error);
      // Clear rendering flag on error
      card.dataset.rendering = "false";
    }
  };

  // Render lightweight placeholder for a thumbnail card (used for initial creation and off-screen unloading)
  const renderThumbnailPlaceholder = (card, data) => {
    // card.innerHTML = "";
    // const placeholder = document.createElement("div");
    // placeholder.className = "thumbnail-loading" + (data.isLandscape ? " landscape" : "") + (data.isMat ? " mat" : "");
    // card.appendChild(placeholder);
    renderDetailedPlaceholder(card, data);
    card.dataset.rendered = "false";
    card.dataset.rendering = "false";
  };

  // Render detailed placeholder with card info (used only for visible cards during thumbnail loading)
  const renderDetailedPlaceholder = (card, data) => {
    card.innerHTML = "";
    const placeholder = document.createElement("div");
    placeholder.className = "thumbnail-loading" + (data.isLandscape ? " landscape" : "") + (data.isMat ? " mat" : "");

    if (data.expansion) {
      const expEl = document.createElement("div");
      expEl.className = "thumbnail-placeholder-expansion";
      expEl.textContent = data.expansion;
      placeholder.appendChild(expEl);
    }

    if (data.price) {
      const costEl = document.createElement("div");
      costEl.className = "thumbnail-placeholder-cost";
      costEl.appendChild(renderCostIcons(data.price));
      placeholder.appendChild(costEl);
    }

    const titleEl = document.createElement("div");
    titleEl.className = "thumbnail-placeholder-title";
    titleEl.textContent = data.fullTitle;
    placeholder.appendChild(titleEl);

    const typeEl = document.createElement("div");
    typeEl.className = "thumbnail-placeholder-type";
    typeEl.textContent = data.fullType;
    placeholder.appendChild(typeEl);

    if (data.description) {
      const textEl = document.createElement("div");
      textEl.className = "thumbnail-placeholder-text";
      textEl.appendChild(renderTextWithIcons(data.description));
      placeholder.appendChild(textEl);
    }

    card.appendChild(placeholder);
  };

  // Create a new IntersectionObserver and attach it to existing thumbnail elements.
  // Uses double-rAF to ensure layout is computed before observation starts.
  const connectThumbnailObserver = () => {
    if (thumbnailObserver) {
      thumbnailObserver.disconnect();
    }
    thumbnailQueue = [];
    isProcessingThumbnailQueue = false;

    thumbnailObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const card = entry.target;
          const id = parseInt(card.dataset.id);
          const cardData = thumbnailDataMap.get(id);

          if (!cardData) return;

          if (entry.isIntersecting) {
            if (card.dataset.rendered !== "true" && card.dataset.rendering !== "true") {
              if (!thumbnailQueue.some((q) => q.card === card)) {
                thumbnailQueue.push({ card, item: cardData.item, data: cardData.data, params: cardData.params });
              }
              processThumbnailQueue();
            }
          } else {
            thumbnailQueue = thumbnailQueue.filter((q) => q.card !== card);
            if (card.dataset.rendered === "true" && card.dataset.rendering !== "true") {
              renderThumbnailPlaceholder(card, cardData.data);
            }
          }
        });
      },
      {
        root: fav.querySelector(".popup-body"),
        rootMargin: "300% 0px 300% 0px",
        threshold: 0,
      },
    );

    // Double-rAF: iOS WebKit sometimes needs two frames for layout to settle.
    // Capture reference to this specific observer to prevent stale rAF callbacks
    // from re-activating a disconnected observer.
    const observer = thumbnailObserver;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Bail if this observer was replaced by a newer one
        if (thumbnailObserver !== observer) return;
        favThumbnails.querySelectorAll(".thumbnail-card").forEach((card) => {
          thumbnailObserver.observe(card);
        });
      });
    });
  };

  this.refreshThumbnails = async function (filteredData) {
    while (favThumbnails.firstChild) {
      favThumbnails.removeChild(favThumbnails.firstChild);
    }

    thumbnailDataMap.clear();
    thumbnailQueue = [];
    isProcessingThumbnailQueue = false;

    const myFavs = this;

    // Create cards with placeholders
    filteredData.forEach((item) => {
      const params = CardDatabase.getParams(item);
      const q = CardDatabase.getData(item);
      const data = extractCardData(q);

      thumbnailDataMap.set(item.id, { item, data, params });

      const card = document.createElement("div");
      card.className = "thumbnail-card" + (data.isMat ? " mat" : "") + (data.isDeleted ? " deleted" : "");
      card.dataset.id = item.id;
      card.dataset.official = item.data?.official ? "true" : "false";
      card.onclick = () => myFavs.load(item.id);

      if (params === document.location.search) {
        card.classList.add("active");
      }

      renderThumbnailPlaceholder(card, data);

      favThumbnails.appendChild(card);
    });

    connectThumbnailObserver();
  };

  // Toggle between list and thumbnail view
  this.toggleView = function () {
    viewMode = viewMode === "list" ? "thumbnail" : "list";
    localStorage.setItem("favoritesViewMode", viewMode);
    updateViewToggleButton();
    this.applyViewMode();
    this.refresh();
  };

  // Toggle official cards visibility
  this.toggleOfficial = async function () {
    showSearchLoading();
    showOfficial = !showOfficial;
    localStorage.setItem("favoritesShowOfficial", showOfficial);
    updateOfficialToggleButton();
    await this.refreshImmediate();
    hideSearchLoading();
  };

  // Apply current view mode
  this.applyViewMode = function () {
    const tbody = favList.querySelector("tbody");
    if (viewMode === "list") {
      if (tbody) tbody.classList.remove("hidden");
      favThumbnails.classList.add("hidden");
    } else {
      if (tbody) tbody.classList.add("hidden");
      favThumbnails.classList.remove("hidden");
    }
  };

  // Initialize view mode on startup
  this.initViewMode = function () {
    updateViewToggleButton();
    updateOfficialToggleButton();
    this.applyViewMode();
  };
}

class FontHandler {
  constructor() {
    this.custom = document.getElementById("fontLocal");
    this.defaultTitle = document.getElementById("fontDefaultTitle");
    this.defaultSpecials = document.getElementById("fontDefaultSpecials");
    this.defaultText = document.getElementById("fontDefaultText");
    this.defaultTextBold = document.getElementById("fontDefaultTextBold");
    this.defaultCredit = document.getElementById("fontDefaultCredit");
    this.dialog = document.getElementById("manage-fonts");
    document.getElementById("openFontSettings").classList.remove("hidden");

    // Add live preview listeners
    ["Title", "Specials", "Text", "TextBold", "Credit"].forEach((id) => {
      document.getElementById("fontInput" + id).addEventListener("input", () => {
        const settings = {
          title: document.getElementById("fontInputTitle").value,
          specials: document.getElementById("fontInputSpecials").value,
          text: document.getElementById("fontInputText").value,
          textBold: document.getElementById("fontInputTextBold").value,
          credit: document.getElementById("fontInputCredit").value,
        };
        this.setFonts(settings.title, settings.specials, settings.text, settings.textBold, settings.credit);
      });
    });

    this.load();
  }

  open() {
    this.dialog.classList.remove("hidden");
    if (window.innerWidth > 600) {
      document.getElementById("fontInputTitle").focus();
    } else {
      document.body.classList.add("no-scroll");
    }
  }

  close() {
    if (window.innerWidth <= 600) {
      this.dialog.classList.add("closing");
      this.dialog.addEventListener(
        "animationend",
        () => {
          this.dialog.classList.remove("closing");
          this.dialog.classList.add("hidden");
          document.body.classList.remove("no-scroll");
        },
        { once: true },
      );
    } else {
      this.dialog.classList.add("hidden");
      document.body.classList.remove("no-scroll");
    }
  }

  save() {
    this.saveSettings();
    this.applySettings();
    this.close();
  }

  saveSettings() {
    this.settings = {
      title: document.getElementById("fontInputTitle").value,
      specials: document.getElementById("fontInputSpecials").value,
      text: document.getElementById("fontInputText").value,
      textBold: document.getElementById("fontInputTextBold").value,
      credit: document.getElementById("fontInputCredit").value,
    };
    localStorage.setItem("fontSettings", JSON.stringify(this.settings));
  }

  applySettings() {
    this.setFonts(this.settings.title, this.settings.specials, this.settings.text, this.settings.textBold, this.settings.credit);
  }

  load() {
    let hasAnyCustomSettings = false;
    this.settings = localStorage.getItem("fontSettings") ? JSON.parse(localStorage.getItem("fontSettings")) : {};
    if (this.settings.title) {
      document.getElementById("fontInputTitle").value = this.settings.title;
      hasAnyCustomSettings = true;
    }
    if (this.settings.specials) {
      document.getElementById("fontInputSpecials").value = this.settings.specials;
      hasAnyCustomSettings = true;
    }
    if (this.settings.text) {
      document.getElementById("fontInputText").value = this.settings.text;
      hasAnyCustomSettings = true;
    }
    if (this.settings.textBold) {
      document.getElementById("fontInputTextBold").value = this.settings.textBold;
      hasAnyCustomSettings = true;
    }
    if (this.settings.credit) {
      document.getElementById("fontInputCredit").value = this.settings.credit;
      hasAnyCustomSettings = true;
    }

    if (hasAnyCustomSettings) {
      this.applySettings();
    }
  }

  check() {
    if (this.settings.title) {
      document.fonts.check("1em '" + this.settings.title + "'");
      console.log("Font available for title: " + this.settings.title);
    }
    if (this.settings.specials) {
      document.fonts.check("1em '" + this.settings.specials + "'");
      console.log("Font available for specials: " + this.settings.specials);
    }
    if (this.settings.text) {
      document.fonts.check("1em '" + this.settings.text + "'");
      console.log("Font available for text: " + this.settings.text);
    }
    if (this.settings.textBold) {
      document.fonts.check("1em '" + this.settings.textBold + "'");
      console.log("Font available for text: " + this.settings.textBold);
    }
    if (this.settings.credit) {
      document.fonts.check("1em '" + this.settings.credit + "'");
      console.log("Font available for credit: " + this.settings.credit);
    }
  }

  async reset() {
    if (await showConfirm("フォント設定をリセットしてもよろしいですか？")) {
      document.getElementById("fontInputTitle").value = "";
      document.getElementById("fontInputSpecials").value = "";
      document.getElementById("fontInputText").value = "";
      document.getElementById("fontInputTextBold").value = "";
      document.getElementById("fontInputCredit").value = "";
      this.save();
    }
  }

  setFonts(lclFontTitle, lclFontSpecials, lclFontText, lclFontTextBold, lclFontCredit) {
    let css = "";

    if (lclFontTitle) {
      css += this.getFontFaceCSS("myTitle", lclFontTitle);
      this.defaultTitle.disabled = true;
    } else {
      this.defaultTitle.disabled = false;
    }

    if (lclFontSpecials) {
      css += this.getFontFaceCSS("mySpecials", lclFontSpecials);
      this.defaultSpecials.disabled = true;
    } else {
      this.defaultSpecials.disabled = false;
    }

    if (lclFontText) {
      css += this.getFontFaceCSS("myText", lclFontText, "normal");
      this.defaultText.disabled = true;
    } else {
      this.defaultText.disabled = false;
    }

    if (lclFontTextBold) {
      css += this.getFontFaceCSS("myText", lclFontTextBold, "bold");
      this.defaultTextBold.disabled = true;
    } else {
      this.defaultTextBold.disabled = false;
    }

    if (lclFontCredit) {
      css += this.getFontFaceCSS("myCredit", lclFontCredit);
      this.defaultCredit.disabled = true;
    } else {
      this.defaultCredit.disabled = false;
    }

    this.custom.innerHTML = css;
    this.triggerChange();
  }

  getFontFaceCSS(myName, lclName, fontWeight) {
    let cssWeight = "";
    if (fontWeight) {
      cssWeight = " font-weight: " + fontWeight + ";";
    }
    return '@font-face { font-family: "' + myName + '"; src: local("' + lclName + '");' + cssWeight + " } ";
  }

  triggerChange() {
    Promise.all([
      document.fonts.load('1em "myTitle"'),
      document.fonts.load('1em "myTitleEn"'),
      document.fonts.load('1em "mySpecials"'),
      document.fonts.load('1em "myText"'),
      document.fonts.load('bold 1em "myText"'),
      document.fonts.load('1em "myCredit"'),
    ]).then(() => {
      document.getElementById("title").onchange();
    });
  }
}
