let templateSize = 0; //save globally
let images = [];
let imagesLoaded = false;

let useCORS = true; // flag to activate loading of external images via CORS helper function -> otherwise canvas is tainted and download button not working
//const CORS_ANYWHERE_BASE_URL = 'https://dominion-card-generator-cors.herokuapp.com/';
//const CORS_ANYWHERE_BASE_URL = 'https://thingproxy.freeboard.io/fetch/';
const CORS_ANYWHERE_BASE_URL = "https://proxy.cors.sh/"; // from https://blog.grida.co/cors-anywhere-for-everyone-free-reliable-cors-proxy-service-73507192714e

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
    "card",
    "カードを引く",
    "buy",
    "カードを購入",
    "action",
    "アクション",
    "coffer",
    "財源",
    "villager",
    "村人",

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
  var boldMarkerPattern = RegExp(boldStartMarkerPattern + "|" + boldEndMarkerPattern, "g");
  var italicMarkerPattern = RegExp(italicStartMarkerPattern + "|" + italicEndMarkerPattern, "g");
  var boldStartMarkerPattern = RegExp(boldStartMarkerPattern, "g");
  var boldEndMarkerPattern = RegExp(boldEndMarkerPattern, "g");
  var italicStartMarkerPattern = RegExp(italicStartMarkerPattern, "g");
  var italicEndMarkerPattern = RegExp(italicEndMarkerPattern, "g");

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
            context.fillText(word, x, y);

            break; //don't start this again
          }
        }
        x += context.measureText(word).width;
        context.restore();
      }
    }

    function writeSingleLine(line, x, y, maxWidth, initialSize, family) {
      family = family || "myTitle";
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
            heightToAdd = (size + heightSize) * 0.75;
            line = "-";
          } else if (blocks.length === 1 && (blocks[0].match(iconWithNumbersPattern) || blocks[0].match(boldLinePatternWords) || blocks[0].match(boldLinePatternWordsSpecial))) {
            line = blocks[0];
            centered = true;
            if (line.startsWith("+")) {
              heightToAdd = (boldSize + heightSize) * 1.433;
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
            for (var j = 0; j < blocks.length; ++j) {
              var isBold = false;
              var isItalic = false;
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
              for (var k = 0; k < block.length; ++k) {
                var width = context.measureText(block[k]).width;
                if (isBold && k === 0) {
                  line += " [b] ";
                }
                if (isItalic && k === 0) {
                  line += " [i] ";
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
                    line = block[k - 1] + block[k];
                    progressiveWidth = prevWidth + width;
                  } else {
                    line = block[k];
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
                  lines.push(lineToAdd);
                  centeredLines.push(centered);
                  widthsPerLine.push(widthToAdd);
                  overallHeight += heightToAdd;
                  heightsPerLine.push(heightToAdd);
                } else {
                  line += block[k];
                  progressiveWidth += width;
                }
              }
              if (isBold) {
                line += " [/b] ";
              }
              if (isItalic) {
                line += " [/i] ";
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
      writeSingleLine(document.getElementById("title").value, 701, 215, previewLine ? 800 : 1180, 75);
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
        writeSingleLine(document.getElementById("title").value, -700, 2030, 750, 70);
        context.restore();
        context.save();
        context.rotate(Math.PI / 2);
        writeSingleLine(document.getElementById("title").value, 700, -120, 750, 70);
        context.restore();
      } else {
        writeSingleLine(document.getElementById("title").value, 1075, 165, 780, 70);

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
      writeSingleLine(document.getElementById("title").value, 701, 215, previewLine ? 800 : 1180, 75);
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
      if (!heirloomLine) writeDescription("description", 701, 1060, 960, 1500, 40);
      else writeDescription("description", 701, 1000, 960, 1400, 40);
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
      writeSingleLine(document.getElementById("title").value, 700, -1920, 500, 75);
      context.restore();
      context.save();
      if (isEachColorDark[1]) context.fillStyle = "white";
      context.rotate((Math.PI * 3) / 2);
      writeSingleLine(document.getElementById("title").value, -700, 230, 500, 75);
      context.restore();
    } else if (templateSize == 5) {
      //player mat
      drawPicture(464, 342, 928, 684);

      context.drawImage(getRecoloredImage(25, 0, 6), 0, 0); //MatBannerTop
      if (document.getElementById("description").value.trim().length > 0) context.drawImage(getRecoloredImage(26, 0, 6), 0, 0); //MatBannerBottom

      context.textAlign = "center";
      context.textBaseline = "middle";

      if (isEachColorDark[1]) context.fillStyle = "white";
      writeSingleLine(document.getElementById("title").value, 464, 96, 490, 55);

      writeDescription("description", 464, 572, 740, 80, 40);

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
    sources.push(icons[key][0] + ".png");
  }
  for (var i = 0; i < sources.length; i++) {
    images.push(new Image());
    images[i].crossOrigin = "Anonymous";
    images[i].src = "card-resources/" + sources[i];
  }

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

    if (url != "[local image]") {
      myFavorites.getDB().deleteLiveImage(id);
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
        images[id] = new Image();
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
  var templateSizeInputs = document.getElementsByName("size");
  for (var i = 0; i < templateSizeInputs.length; ++i)
    templateSizeInputs[i].onchange = (function (i) {
      return function () {
        templateSize = parseInt(this.value);
        document.body.className = this.id;
        document.body.classList.add("trait");
        document.getElementById("load-indicator").removeAttribute("style");
        queueDraw(250);
      };
    })(i);

  //ready to begin: load information from query parameters
  var query = getQueryParams(document.location.search);
  document.body.className = "";
  for (var queryKey in query) {
    switch (queryKey) {
      case "color0":
        normalColorCurrentIndices[0] = normalColorDropdowns[0].selectedIndex = query[queryKey];
        break;
      case "color1":
        normalColorCurrentIndices[1] = normalColorDropdowns[1].selectedIndex = query[queryKey];
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
    imagesLoaded = false;
    queueDraw(250);
  };

  window.onUploadImage = function (id, file) {
    onUploadImage(id, file);
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
          normalColorCurrentIndices[0] = normalColorDropdowns[0].selectedIndex = query[queryKey];
          break;
        case "color1":
          normalColorCurrentIndices[1] = normalColorDropdowns[1].selectedIndex = query[queryKey];
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
    recoloredImages = [];
    imagesLoaded = false;
    queueDraw(1);
  };
}

function getQueryParams(qs) {
  //http://stackoverflow.com/questions/979975/how-to-get-the-value-from-the-get-parameters
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

// Text Edit Modal for mobile
let textEditPendingCustomIconFile = null;

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

  modal.classList.remove("hidden");
  lockScroll();
  document.activeElement.blur();
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
  modal.classList.add("hidden");
  unlockScroll();
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

  modal.classList.remove("hidden");
  lockScroll();
  document.activeElement.blur();
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
  modal.classList.add("hidden");
  unlockScroll();
}

function resetPictureEditPosition() {
  document.getElementById("picture-edit-x").value = 0;
  document.getElementById("picture-edit-y").value = 0;
  document.getElementById("picture-edit-zoom").value = 1;
}

// Type Edit Modal for mobile
function openTypeEditModal() {
  const modal = document.getElementById("type-edit-modal");
  const color1Select = document.getElementById("type-edit-color1");
  const color2Select = document.getElementById("type-edit-color2");
  const typeInput = document.getElementById("type-edit-type");
  const heirloomInput = document.getElementById("type-edit-heirloom");
  const deckSizeInput = document.getElementById("type-edit-decksize");
  const mainColor1Select = document.getElementById("normalcolor1");
  const mainColor2Select = document.getElementById("normalcolor2");

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

  modal.classList.remove("hidden");
  lockScroll();
  document.activeElement.blur();
}

function closeTypeEditModal(apply) {
  const modal = document.getElementById("type-edit-modal");

  if (apply) {
    const color1Select = document.getElementById("type-edit-color1");
    const color2Select = document.getElementById("type-edit-color2");
    const typeInput = document.getElementById("type-edit-type");
    const heirloomInput = document.getElementById("type-edit-heirloom");
    const deckSizeInput = document.getElementById("type-edit-decksize");
    const mainColor1Select = document.getElementById("normalcolor1");
    const mainColor2Select = document.getElementById("normalcolor2");

    // Apply colors if changed
    if (mainColor1Select.selectedIndex !== color1Select.selectedIndex) {
      mainColor1Select.selectedIndex = color1Select.selectedIndex;
      mainColor1Select.dispatchEvent(new Event("change"));
    }
    if (mainColor2Select.selectedIndex !== color2Select.selectedIndex) {
      mainColor2Select.selectedIndex = color2Select.selectedIndex;
      mainColor2Select.dispatchEvent(new Event("change"));
    }

    document.getElementById("type").value = typeInput.value;
    document.getElementById("type").dispatchEvent(new Event("change"));

    document.getElementById("type2").value = heirloomInput.value;
    document.getElementById("type2").dispatchEvent(new Event("change"));

    document.getElementById("deckSize").value = deckSizeInput.value;
    document.getElementById("deckSize").dispatchEvent(new Event("change"));
  }

  modal.classList.add("hidden");
  unlockScroll();
}

// Title Edit Modal for mobile
let titleEditPendingExpansionIconFile = null;

function openTitleEditModal() {
  const modal = document.getElementById("title-edit-modal");
  const expansionInput = document.getElementById("title-edit-expansion");
  const expansionIconInput = document.getElementById("title-edit-expansion-icon");
  const expansionIconUpload = document.getElementById("title-edit-expansion-icon-upload");
  const titleInput = document.getElementById("title-edit-title");

  // Reset pending file
  titleEditPendingExpansionIconFile = null;
  expansionIconUpload.value = "";

  // Sync values from main form
  expansionInput.value = document.getElementById("expansionName").value;
  expansionIconInput.value = document.getElementById("expansion").value;
  titleInput.value = document.getElementById("title").value;

  modal.classList.remove("hidden");
  lockScroll();
  document.activeElement.blur();
}

function closeTitleEditModal(apply) {
  const modal = document.getElementById("title-edit-modal");

  if (apply) {
    const expansionInput = document.getElementById("title-edit-expansion");
    const expansionIconInput = document.getElementById("title-edit-expansion-icon");
    const titleInput = document.getElementById("title-edit-title");

    document.getElementById("expansionName").value = expansionInput.value;
    document.getElementById("expansionName").dispatchEvent(new Event("change"));

    // Handle expansion icon - either uploaded file or URL
    if (titleEditPendingExpansionIconFile) {
      document.getElementById("expansion").value = "[local image]";
      window.onUploadImage(17, titleEditPendingExpansionIconFile);
    } else if (expansionIconInput.value !== document.getElementById("expansion").value) {
      document.getElementById("expansion").value = expansionIconInput.value;
      document.getElementById("expansion").dispatchEvent(new Event("change"));
    }

    document.getElementById("title").value = titleInput.value;
    document.getElementById("title").dispatchEvent(new Event("change"));
  }

  titleEditPendingExpansionIconFile = null;
  modal.classList.add("hidden");
  unlockScroll();
}

// Credit Edit Modal for mobile
function openCreditEditModal() {
  const modal = document.getElementById("credit-edit-modal");
  const artInput = document.getElementById("credit-edit-art");
  const versionInput = document.getElementById("credit-edit-version");

  // Sync values from main form
  artInput.value = document.getElementById("credit").value;
  versionInput.value = document.getElementById("creator").value;

  modal.classList.remove("hidden");
  lockScroll();
  document.activeElement.blur();
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

  modal.classList.add("hidden");
  unlockScroll();
}

// Preview Edit Modal for mobile
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

  modal.classList.remove("hidden");
  lockScroll();
  document.activeElement.blur();
}

function closePreviewEditModal(apply) {
  const modal = document.getElementById("preview-edit-modal");

  if (apply) {
    const previewInput = document.getElementById("preview-edit-preview");
    document.getElementById("preview").value = previewInput.value;
    document.getElementById("preview").dispatchEvent(new Event("change"));
  }

  modal.classList.add("hidden");
  unlockScroll();
}

// Cost Edit Modal for mobile
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

  modal.classList.remove("hidden");
  lockScroll();
  document.activeElement.blur();
}

function closeCostEditModal(apply) {
  const modal = document.getElementById("cost-edit-modal");

  if (apply) {
    const priceInput = document.getElementById("cost-edit-price");

    document.getElementById("price").value = priceInput.value;
    document.getElementById("price").dispatchEvent(new Event("change"));
  }

  modal.classList.add("hidden");
  unlockScroll();
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

  modal.classList.remove("hidden");
  lockScroll();
  document.activeElement.blur();
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
  modal.classList.add("hidden");
  unlockScroll();
}

// Setup mobile canvas tap handler
function setupMobileCanvasTap() {
  if (window.innerWidth > 600) return;

  const canvasWrapper = document.querySelector(".canvas-wrapper");
  canvasWrapper.addEventListener("click", function (e) {
    // Only on mobile
    if (window.innerWidth > 600) return;

    // Get tap position relative to canvas
    const canvas = canvasWrapper.querySelector("canvas");
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const relativeX = x / rect.width;
    const relativeY = y / rect.height;

    // Bottom left corner (cost area): Y > 80% and X < 20%
    if (relativeY > 0.8 && relativeX < 0.2) {
      openCostEditModal();
      return;
    }

    // Bottom right corner (expansion area): Y > 80% and X > 80%
    if (relativeY > 0.8 && relativeX > 0.8) {
      openExpansionEditModal();
      return;
    }

    // Top left corner (preview area): Y < 20% and X < 20%
    if (relativeY < 0.2 && relativeX < 0.2) {
      openPreviewEditModal();
      return;
    }

    // Top right corner (preview area): Y < 20% and X > 80%
    if (relativeY < 0.2 && relativeX > 0.8) {
      openPreviewEditModal();
      return;
    }

    // Top ~20%: title area
    // 20-50%: illustration area
    // 50-85%: text area
    // 85-95%: type area
    // Bottom ~5%: credit area
    if (relativeY < 0.2) {
      openTitleEditModal();
    } else if (relativeY < 0.5) {
      openPictureEditModal();
    } else if (relativeY < 0.85) {
      openTextEditModal();
    } else if (relativeY < 0.95) {
      openTypeEditModal();
    } else {
      openCreditEditModal();
    }
  });
}

// Setup all mobile modal upload handlers
function setupMobileModalUploadHandlers() {
  // Text edit custom icon upload
  const textEditUpload = document.getElementById("text-edit-custom-icon-upload");
  if (textEditUpload) {
    textEditUpload.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        textEditPendingCustomIconFile = this.files[0];
        document.getElementById("text-edit-custom-icon").value = "[local image]";
      }
    });
  }

  // Picture edit upload
  const pictureEditUpload = document.getElementById("picture-edit-upload");
  if (pictureEditUpload) {
    pictureEditUpload.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        pictureEditPendingFile = this.files[0];
        document.getElementById("picture-edit-url").value = "[local image]";
      }
    });
  }

  // Title edit expansion icon upload
  const titleEditUpload = document.getElementById("title-edit-expansion-icon-upload");
  if (titleEditUpload) {
    titleEditUpload.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        titleEditPendingExpansionIconFile = this.files[0];
        document.getElementById("title-edit-expansion-icon").value = "[local image]";
      }
    });
  }

  // Expansion edit icon upload
  const expansionEditUpload = document.getElementById("expansion-edit-icon-upload");
  if (expansionEditUpload) {
    expansionEditUpload.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        expansionEditPendingIconFile = this.files[0];
        document.getElementById("expansion-edit-icon").value = "[local image]";
      }
    });
  }
}

// Initialize mobile handlers when DOM is ready
function initMobileHandlers() {
  setupMobileCanvasTap();
  setupMobileModalUploadHandlers();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMobileHandlers);
} else {
  initMobileHandlers();
}

// function to download the finished card
function downloadPicture() {
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
    alert("Sorry, canvas is tainted! Please use the right-click-option to save your image.");
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
  }
}

class CardDatabase {
  constructor() {
    this.dbName = "DominionCardGenerator";
    this.storeName = "favorites";
    this.liveStoreName = "live_images";
    this.version = 2;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, {
            keyPath: "id",
            autoIncrement: true,
          });
        }
        if (!db.objectStoreNames.contains(this.liveStoreName)) {
          db.createObjectStore(this.liveStoreName, {
            keyPath: "id",
          });
        }
      };
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async getAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async add(card) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.add(card);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async update(card) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(card);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveLiveImage(id, data) {
    if (!this.db) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.liveStoreName, "readwrite");
      const store = transaction.objectStore(this.liveStoreName);
      const request = store.put({ id, data, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getLiveImage(id) {
    if (!this.db) {
      return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.liveStoreName, "readonly");
      const store = transaction.objectStore(this.liveStoreName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteLiveImage(id) {
    if (!this.db) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.liveStoreName, "readwrite");
      const store = transaction.objectStore(this.liveStoreName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
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
  var sortState = []; // Array of {column: string, direction: 'asc'|'desc'}
  var viewMode = localStorage.getItem("favoritesViewMode") || "thumbnail"; // "list" or "thumbnail"

  // Sort data based on current sortState
  const sortData = (data) => {
    if (sortState.length === 0) return data;

    return data.slice().sort((a, b) => {
      for (const sort of sortState) {
        const aParams = getQueryParams(a.params);
        const bParams = getQueryParams(b.params);
        let aVal, bVal;

        switch (sort.column) {
          case "expansion":
            aVal = (aParams.expansionName || "").trim().toLowerCase();
            bVal = (bParams.expansionName || "").trim().toLowerCase();
            break;
          case "size":
            aVal = parseInt(aParams.size || "0");
            bVal = parseInt(bParams.size || "0");
            break;
          case "cost":
            // Parse cost: extract numeric value, handle $ and special symbols
            const parseCost = (price) => {
              if (!price) return 0;
              const match = price.match(/\d+/);
              return match ? parseInt(match[0]) : 0;
            };
            aVal = parseCost(aParams.price);
            bVal = parseCost(bParams.price);
            break;
          case "title":
            aVal = (aParams.title || "").trim().toLowerCase();
            bVal = (bParams.title || "").trim().toLowerCase();
            break;
          case "type":
            aVal = (aParams.type || "").trim().toLowerCase();
            bVal = (bParams.type || "").trim().toLowerCase();
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

  // Generate thumbnail from current canvas
  const generateThumbnail = () => {
    const canvases = document.getElementsByClassName("myCanvas");

    // Select canvas based on templateSize (matching draw() logic)
    let canvasIndex;
    if (templateSize === 0 || templateSize === 2 || templateSize === 3) {
      canvasIndex = 0;
    } else if (templateSize === 1 || templateSize === 4) {
      canvasIndex = 1;
    } else {
      canvasIndex = 2;
    }

    const canvas = canvases[canvasIndex];
    if (!canvas) return null;

    try {
      // Create a smaller thumbnail for display
      const maxSize = 800;
      const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height);
      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = canvas.width * scale;
      thumbCanvas.height = canvas.height * scale;
      const ctx = thumbCanvas.getContext("2d");
      ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      return thumbCanvas.toDataURL("image/png", 0.8);
    } catch (e) {
      console.error("Failed to generate thumbnail:", e);
      return null;
    }
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
    this.refresh();
  };

  db.init().then(async () => {
    this.refresh();
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
    };

    // Use the existing pattern to find symbols with numbers
    // e.g. $3, ^, @2, %2
    const pat = RegExp("([-+]?\\d+)?([" + Object.keys(iconMap).join("") + "])([\\d\\?]*[-+\\*]?)", "g");

    let match;
    while ((match = pat.exec(price)) !== null) {
      const prefix = match[1] || "";
      const symbolChar = match[2];
      const suffix = match[3] || "";

      const iconClass = iconMap[symbolChar];
      if (iconClass) {
        const iconDiv = document.createElement("div");
        iconDiv.className = "cost-icon " + iconClass;

        // If there's a prefix (+1) or a numeric suffix ($3), show it centered
        const value = prefix + suffix;
        if (value) {
          const span = document.createElement("span");
          span.textContent = value;
          iconDiv.appendChild(span);
        }

        container.appendChild(iconDiv);
      }
    }

    // fallback for plain numbers if any (though usually they have $)
    if (!container.hasChildNodes() && price.trim()) {
      const span = document.createElement("span");
      span.textContent = price;
      container.appendChild(span);
    }

    return container;
  };

  this.export = async function () {
    // Get visible item IDs from the list view (search already handles .hidden class)
    const visibleRows = favList.querySelectorAll("tbody tr:not(.hidden)");
    const visibleIds = new Set(Array.from(visibleRows).map((tr) => parseInt(tr.dataset.id)));

    if (visibleIds.size === 0) {
      alert("エクスポートするカードがありません。");
      return;
    }

    const allData = await db.getAll();
    const filteredData = allData.filter((item) => visibleIds.has(item.id));

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
    }
  };

  this.exportPDF = async function () {
    const pdfBtn = document.getElementById("pdf-export-btn");
    if (pdfBtn) pdfBtn.disabled = true;

    try {
      // Check if jsPDF is loaded
      let jsPDF;
      if (window.jspdf && window.jspdf.jsPDF) {
        jsPDF = window.jspdf.jsPDF;
      } else if (window.jsPDF) {
        jsPDF = window.jsPDF;
      } else {
        console.error("jsPDF not found. window.jspdf:", window.jspdf, "window.jsPDF:", window.jsPDF);
        alert("PDFライブラリの読み込みに失敗しました。ページを再読み込みしてください。");
        return;
      }

      // Get visible thumbnail cards (not hidden by search filter)
      const thumbnailCards = favThumbnails.querySelectorAll(".thumbnail-card:not(.hidden)");
      if (thumbnailCards.length === 0) {
        alert("出力するカードがありません。");
        return;
      }

      // Collect card IDs and their types
      const cardIds = [];
      for (const card of thumbnailCards) {
        const id = parseInt(card.dataset.id);
        const img = card.querySelector(".thumbnail-image");
        if (id && img) {
          const isLandscape = img.classList.contains("landscape");
          const isMat = img.classList.contains("mat");
          cardIds.push({ id, isLandscape, isMat });
        }
      }

      if (cardIds.length === 0) {
        alert("出力するカードがありません。");
        return;
      }

      // Create progress indicator
      const progressEl = document.createElement("div");
      progressEl.className = "pdf-progress";
      progressEl.innerHTML = `
        <div class="pdf-progress-title">PDF出力中...</div>
        <div class="pdf-progress-bar"><div class="pdf-progress-bar-fill" style="width: 0%"></div></div>
        <div class="pdf-progress-text">0 / ${cardIds.length} カード</div>
      `;
      document.body.appendChild(progressEl);

      const updateProgress = (current, total, status) => {
        const percent = Math.round((current / total) * 100);
        progressEl.querySelector(".pdf-progress-bar-fill").style.width = percent + "%";
        progressEl.querySelector(".pdf-progress-text").textContent = status || `${current} / ${total} カード`;
      };

      // Create hidden iframe for background rendering
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1600px;height:2400px;visibility:hidden;";
      document.body.appendChild(iframe);

      // Wait for iframe to load
      await new Promise((resolve) => {
        iframe.onload = resolve;
        iframe.src = location.pathname;
      });

      // Helper function to render card in iframe
      const renderCardInIframe = (cardData, cardInfo) => {
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
                      newImg.src = src;
                      setTimeout(done, 2000);
                    } else {
                      done();
                    }
                  });
                };

                await Promise.all([loadImage(5, cardData.images?.illustration), loadImage(17, cardData.images?.expansion), loadImage(customIconIndex, cardData.images?.customIcon)]);

                // Apply params and wait for render
                iframeWindow.applyQueryParams(cardData.params);

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
                    setTimeout(check, 200);
                  });
                };

                await waitForRender();

                // Capture canvas
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

      // Render each card and collect images
      const cardImages = [];
      const totalCards = cardIds.length;

      for (let i = 0; i < cardIds.length; i++) {
        const cardInfo = cardIds[i];
        const cardData = await db.get(cardInfo.id);

        if (cardData) {
          const dataUrl = await renderCardInIframe(cardData, cardInfo);
          if (dataUrl) {
            // Get deck size for repetition (only for size 0 and 2)
            const q = getQueryParams(cardData.params);
            const size = q.size || "0";
            let repeatCount = 1;
            if (size === "0" || size === "2") {
              repeatCount = parseInt(q.deckSize) || 10;
            }

            for (let r = 0; r < repeatCount; r++) {
              cardImages.push({
                src: dataUrl,
                isLandscape: cardInfo.isLandscape,
                isMat: cardInfo.isMat,
              });
            }
          }
        }

        updateProgress(i + 1, totalCards);
      }

      // Remove iframe
      document.body.removeChild(iframe);

      if (cardImages.length === 0) {
        document.body.removeChild(progressEl);
        alert("画像の取得に失敗しました。");
        return;
      }

      updateProgress(totalCards, totalCards, "PDF生成中...");

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
      const landscapeWidth = 91;
      const landscapeHeight = 59;
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
        } else if (cardData.isLandscape) {
          w = landscapeWidth;
          h = landscapeHeight;
        } else {
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
      document.body.removeChild(progressEl);

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

      if (pdfBtn) pdfBtn.disabled = false;
    } catch (error) {
      console.error("PDF export error:", error);
      // Remove progress indicator if exists
      const progressEl = document.querySelector(".pdf-progress");
      if (progressEl) document.body.removeChild(progressEl);
      if (pdfBtn) pdfBtn.disabled = false;
      alert("PDF出力中にエラーが発生しました: " + error.message);
    }
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

    try {
      // Get visible thumbnail cards (not hidden by search filter)
      const thumbnailCards = favThumbnails.querySelectorAll(".thumbnail-card:not(.hidden)");
      if (thumbnailCards.length === 0) {
        alert("出力するカードがありません");
        if (exportBtn) exportBtn.disabled = false;
        return;
      }

      // Collect card IDs
      const cardIds = [];
      for (const card of thumbnailCards) {
        const id = parseInt(card.dataset.id);
        if (id) {
          cardIds.push(id);
        }
      }

      if (cardIds.length === 0) {
        alert("出力するカードがありません");
        if (exportBtn) exportBtn.disabled = false;
        return;
      }

      // Create progress indicator
      const progressEl = document.createElement("div");
      progressEl.className = "pdf-progress";
      progressEl.innerHTML = `
        <div class="pdf-progress-title">画像をダウンロード中...</div>
        <div class="pdf-progress-bar"><div class="pdf-progress-bar-fill" style="width: 0%"></div></div>
        <div class="pdf-progress-text">0 / ${cardIds.length}</div>
      `;
      document.body.appendChild(progressEl);

      const updateProgress = (current, total) => {
        const percent = Math.round((current / total) * 100);
        progressEl.querySelector(".pdf-progress-bar-fill").style.width = percent + "%";
        progressEl.querySelector(".pdf-progress-text").textContent = `${current} / ${total}`;
      };

      // Create hidden iframe for background rendering
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1600px;height:2400px;visibility:hidden;";
      document.body.appendChild(iframe);

      // Wait for iframe to load
      await new Promise((resolve) => {
        iframe.onload = resolve;
        iframe.src = location.pathname;
      });

      // Helper function to render card in iframe
      const renderCardInIframe = (cardData) => {
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
                      newImg.src = src;
                      setTimeout(done, 2000);
                    } else {
                      done();
                    }
                  });
                };

                await Promise.all([loadImage(5, cardData.images?.illustration), loadImage(17, cardData.images?.expansion), loadImage(customIconIndex, cardData.images?.customIcon)]);

                // Apply params and wait for render
                iframeWindow.applyQueryParams(cardData.params);

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
                    setTimeout(check, 200);
                  });
                };

                await waitForRender();

                // Get size from params
                const q = getQueryParams(cardData.params);
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
                    resolve({ dataUrl, params: q });
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

      // Process each card
      for (let i = 0; i < cardIds.length; i++) {
        const cardId = cardIds[i];
        const cardData = await db.get(cardId);

        if (cardData) {
          const result = await renderCardInIframe(cardData);

          if (result) {
            // Generate filename
            const expansionName = sanitizeFilename(result.params.expansionName || "");
            const cardName = sanitizeFilename(result.params.title || "card");
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

        updateProgress(i + 1, cardIds.length);
      }

      // Clean up iframe
      document.body.removeChild(iframe);

      // Generate and download ZIP
      progressEl.querySelector(".pdf-progress-title").textContent = "ZIPを作成中...";
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
      document.body.removeChild(progressEl);

      if (exportBtn) exportBtn.disabled = false;
    } catch (error) {
      console.error("Image export error:", error);
      const progressEl = document.querySelector(".pdf-progress");
      if (progressEl) document.body.removeChild(progressEl);
      const iframe = document.querySelector("iframe[style*='-9999px']");
      if (iframe) document.body.removeChild(iframe);
      if (exportBtn) exportBtn.disabled = false;
      alert("画像出力中にエラーが発生しました: " + error.message);
    }
  };

  this.import = function () {
    let myFavs = this;

    let inp = document.createElement("input");
    inp.type = "file";

    inp.onchange = (e) => {
      let file = e.target.files[0];
      let reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = async (readerEvent) => {
        let content = readerEvent.target.result;
        let newData = JSON.parse(content);
        if (Array.isArray(newData)) {
          for (const item of newData) {
            // strip ID to allow auto-increment if it's there
            delete item.id;
            await db.add(item);
          }
        }
        myFavs.refresh();
      };
    };
    inp.click();
  };

  this.open = function () {
    this.initViewMode();
    this.refresh();
    fav.classList.remove("hidden");
    if (window.innerWidth > 600) {
      document.getElementById("favorites-search").focus();
    } else {
      document.body.classList.add("no-scroll");
    }
  };
  this.close = function () {
    fav.classList.add("hidden");
    document.body.classList.remove("no-scroll");
  };
  this.deleteAll = async function () {
    if (!confirm("お気に入りをすべて削除してもよろしいですか？")) return;
    const all = await db.getAll();
    for (const item of all) {
      await db.delete(item.id);
    }
    this.refresh();
  };
  this.delete = async function (id) {
    const card = await db.get(id);
    if (card) {
      if (!confirm(card.title + " を削除してもよろしいですか？")) return;
      await db.delete(id);
      this.refresh();
    }
  };
  this.add = async function (params) {
    const q = getQueryParams(params);
    // Only save images if the form field has a value
    const pictureField = document.getElementById("picture").value.trim();
    const expansionField = document.getElementById("expansion").value.trim();
    const customIconField = document.getElementById("custom-icon").value.trim();

    const card = {
      params: params,
      title: q.title || "Untitled",
      images: {
        illustration: pictureField ? await db.getLiveImage(5) : null,
        expansion: expansionField ? await db.getLiveImage(17) : null,
        customIcon: customIconField ? await db.getLiveImage(images.length - 1) : null,
      },
      thumbnail: generateThumbnail(),
      size: q.size || "0",
      timestamp: Date.now(),
    };
    await db.add(card);
    this.refresh();
  };
  this.addOrUpdate = async function () {
    const currentTitle = document.getElementById("title").value.trim();
    const currentExpansion = document.getElementById("expansionName").value.trim();
    const all = await db.getAll();
    let match = null;

    for (const item of all) {
      const itemParams = getQueryParams(item.params);
      const itemTitle = (itemParams.title || "").trim();
      const itemExpansion = (itemParams.expansionName || "").trim();

      if (itemTitle === currentTitle && itemExpansion === currentExpansion) {
        match = item;
        break;
      }
    }

    if (match) {
      await this.update(match.id);
    } else {
      await this.add(document.location.search);
      alert("お気に入りに追加しました。");
    }
  };
  this.update = async function (id) {
    const existingCard = await db.get(id);
    const newTitle = document.getElementById("title").value || "Untitled";

    if (existingCard && existingCard.title !== newTitle) {
      if (!confirm("カード名を 「" + existingCard.title + "」 から 「" + newTitle + "」 に変更して更新しますか？")) return;
    }

    const q = getQueryParams(document.location.search);
    // Only save images if the form field has a value
    const pictureField = document.getElementById("picture").value.trim();
    const expansionField = document.getElementById("expansion").value.trim();
    const customIconField = document.getElementById("custom-icon").value.trim();

    const card = {
      id: id,
      params: document.location.search,
      title: newTitle,
      images: {
        illustration: pictureField ? await db.getLiveImage(5) : null,
        expansion: expansionField ? await db.getLiveImage(17) : null,
        customIcon: customIconField ? await db.getLiveImage(images.length - 1) : null,
      },
      thumbnail: generateThumbnail(),
      size: q.size || "0",
      timestamp: Date.now(),
    };
    await db.update(card);
    this.refresh();
    alert(card.title + " を更新しました。");
  };
  this.load = async function (id) {
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

      // Update URL without navigation
      history.pushState(null, "", location.pathname + card.params);

      // Apply parameters to update form fields
      window.applyQueryParams(card.params);

      // Load images into the view
      if (card.images.illustration) {
        window.setImageSource(5, card.images.illustration);
        document.getElementById("picture").value = "[local image]";
      } else {
        window.clearImageSource(5);
        document.getElementById("picture").value = "";
      }

      if (card.images.expansion) {
        window.setImageSource(17, card.images.expansion);
        document.getElementById("expansion").value = "[local image]";
      } else {
        window.clearImageSource(17);
        document.getElementById("expansion").value = "";
      }

      if (card.images.customIcon) {
        window.setImageSource(images.length - 1, card.images.customIcon);
        document.getElementById("custom-icon").value = "[local image]";
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

  this.search = function (term) {
    let keywords = term
      .toUpperCase()
      .split(/\s+/)
      .filter((k) => k.length > 0);

    // Search in list view
    let rows = favList.getElementsByTagName("tr");
    for (let i = 0; i < rows.length; i++) {
      let tr = rows[i];
      if (tr.parentElement.tagName === "THEAD") continue; // Skip header row

      let matchText = tr.textContent.toUpperCase();
      let allMatch = keywords.every((k) => matchText.includes(k));
      if (allMatch) {
        tr.classList.remove("hidden");
      } else {
        tr.classList.add("hidden");
      }
    }

    // Search in thumbnail view
    let cards = favThumbnails.getElementsByClassName("thumbnail-card");
    for (let i = 0; i < cards.length; i++) {
      let card = cards[i];
      let matchText = (
        (card.dataset.title || "") +
        " " +
        (card.dataset.type || "") +
        " " +
        (card.dataset.expansion || "") +
        " " +
        (card.dataset.size || "") +
        " " +
        (card.dataset.price || "") +
        " " +
        card.textContent
      ).toUpperCase();
      let allMatch = keywords.every((k) => matchText.includes(k));
      if (allMatch) {
        card.classList.remove("hidden");
      } else {
        card.classList.add("hidden");
      }
    }
  };

  this.refresh = async function () {
    const allData = await db.getAll();
    const sortedData = sortData(allData);

    // Refresh both views
    while (favList.firstChild) {
      favList.removeChild(favList.firstChild);
    }

    // Also refresh thumbnails view
    await this.refreshThumbnails(sortedData);

    // Table Header (in fixed header area)
    const tableHeader = document.getElementById("favorites-table-header");
    tableHeader.innerHTML = "";
    const columns = [
      { label: "拡張名", key: "expansion", class: "col-expansion" },
      { label: "種類", key: "size", class: "col-size" },
      { label: "コスト", key: "cost", class: "col-cost" },
      { label: "カード名", key: "title", class: "col-title" },
      { label: "種別", key: "type", class: "col-type" },
    ];

    columns.forEach((col) => {
      let th = document.createElement("span");
      th.className = "table-header-cell " + col.class;
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
      tableHeader.appendChild(th);
    });

    let tbody = document.createElement("tbody");
    favList.appendChild(tbody);

    sortedData.forEach((item) => {
      let params = item.params;
      let q = getQueryParams(params);
      let title = (q.title || "").trim();
      if (title === "") title = "<名称未決定>";
      let title2 = (q.title2 || "").trim();
      let type = (q.type || "").trim();
      let type2 = (q.type2 || "").trim();
      let price = (q.price || "").replace("^", "P").trim();
      let sizeText = "";

      switch (q.size) {
        case "0":
          sizeText = "カード";
          break;
        case "1":
          sizeText = "ランドスケープ";
          break;
        case "2":
          sizeText = "ダブル";
          break;
        case "3":
          sizeText = "ベース";
          break;
        case "4":
          sizeText = "マーカー";
          break;
        case "5":
          sizeText = "マット";
          break;
      }

      let expansionName = (q.expansionName || "").trim();

      let tr = document.createElement("tr");
      tr.dataset.id = item.id;
      tr.onclick = () => this.load(item.id);
      if (params === document.location.search) {
        tr.setAttribute("class", "active");
      }

      // 1. Expansion
      let tdExp = document.createElement("td");
      tdExp.setAttribute("class", "expansion");
      tdExp.appendChild(document.createTextNode(expansionName));
      tr.appendChild(tdExp);

      // 2. Size
      let tdSize = document.createElement("td");
      tdSize.setAttribute("class", "size");
      tdSize.appendChild(document.createTextNode(sizeText));
      tr.appendChild(tdSize);

      // 3. Cost
      let tdCost = document.createElement("td");
      tdCost.setAttribute("class", "cost");
      tdCost.appendChild(renderCostIcons(q.price));
      // Keep raw price in a hidden attribute for easier text-based AND search if needed,
      // or just rely on tr.textContent which search() uses.
      tr.appendChild(tdCost);

      // 4. Card Name
      let tdTitle = document.createElement("td");
      tdTitle.setAttribute("class", "title");
      let displayName = title;
      if (title2 !== "") displayName += " | " + title2;
      tdTitle.appendChild(document.createTextNode(displayName));
      tr.appendChild(tdTitle);

      // 5. Type (with hover actions)
      let tdType = document.createElement("td");
      tdType.setAttribute("class", "type");

      let typeSpan = document.createElement("span");
      let typeText = type;
      if (type2 !== "") typeText += " | " + type2;
      typeSpan.appendChild(document.createTextNode(typeText));
      tdType.appendChild(typeSpan);

      // Hover actions
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

      tdType.appendChild(actions);
      tr.appendChild(tdType);

      tbody.appendChild(tr);
    });

    // Re-apply search filter if there's a search term
    const searchInput = document.getElementById("favorites-search");
    if (searchInput && searchInput.value) {
      this.search(searchInput.value);
    }
  };

  // Render thumbnail view
  this.refreshThumbnails = async function (sortedData) {
    while (favThumbnails.firstChild) {
      favThumbnails.removeChild(favThumbnails.firstChild);
    }

    const myFavs = this;

    sortedData.forEach((item) => {
      const params = item.params;
      const q = getQueryParams(params);
      const title = (q.title || "").trim() || "<名称未決定>";
      const title2 = (q.title2 || "").trim();
      const type = (q.type || "").trim();
      const type2 = (q.type2 || "").trim();
      const size = item.size || q.size || "0";
      const price = (q.price || "").replace("^", "P").trim();
      const isLandscape = size === "1" || size === "4"; // Landscape or Pile Marker
      const isMat = size === "5"; // Mat

      let sizeText = "";
      switch (size) {
        case "0":
          sizeText = "カード";
          break;
        case "1":
          sizeText = "ランドスケープ";
          break;
        case "2":
          sizeText = "ダブル";
          break;
        case "3":
          sizeText = "ベース";
          break;
        case "4":
          sizeText = "マーカー";
          break;
        case "5":
          sizeText = "マット";
          break;
      }

      const card = document.createElement("div");
      card.className = "thumbnail-card" + (isMat ? " mat" : "");
      card.dataset.id = item.id;
      card.dataset.title = title;
      card.dataset.type = type;
      card.dataset.expansion = (q.expansionName || "").trim();
      card.dataset.size = sizeText;
      card.dataset.price = price;
      card.onclick = () => myFavs.load(item.id);

      if (params === document.location.search) {
        card.classList.add("active");
      }

      // Thumbnail image or placeholder with card info
      if (item.thumbnail) {
        const img = document.createElement("img");
        img.className = "thumbnail-image" + (isLandscape ? " landscape" : "") + (isMat ? " mat" : "");
        img.src = item.thumbnail;
        img.alt = title;
        card.appendChild(img);
      } else {
        // No thumbnail: show expansion, title, and type
        const placeholder = document.createElement("div");
        placeholder.className = "thumbnail-loading" + (isLandscape ? " landscape" : "") + (isMat ? " mat" : "");

        const expansionName = (q.expansionName || "").trim();
        if (expansionName) {
          const expEl = document.createElement("div");
          expEl.className = "thumbnail-placeholder-expansion";
          expEl.textContent = expansionName;
          placeholder.appendChild(expEl);
        }

        const titleEl = document.createElement("div");
        titleEl.className = "thumbnail-placeholder-title";
        let displayName = title;
        if (title2 !== "") displayName += " | " + title2;
        titleEl.textContent = displayName;
        placeholder.appendChild(titleEl);

        const typeEl = document.createElement("div");
        typeEl.className = "thumbnail-placeholder-type";
        let typeText = type;
        if (type2 !== "") typeText += " | " + type2;
        typeEl.textContent = typeText;
        placeholder.appendChild(typeEl);

        card.appendChild(placeholder);
      }

      // Action buttons
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
      favThumbnails.appendChild(card);
    });
  };

  // Toggle between list and thumbnail view
  this.toggleView = function () {
    viewMode = viewMode === "list" ? "thumbnail" : "list";
    localStorage.setItem("favoritesViewMode", viewMode);
    updateViewToggleButton();
    this.applyViewMode();
    this.refresh();
  };

  // Apply current view mode
  this.applyViewMode = function () {
    if (viewMode === "list") {
      favList.classList.remove("hidden");
      favThumbnails.classList.add("hidden");
    } else {
      favList.classList.add("hidden");
      favThumbnails.classList.remove("hidden");
    }
  };

  // Initialize view mode on startup
  this.initViewMode = function () {
    updateViewToggleButton();
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
    this.dialog = document.getElementById("manage-fonts");
    document.getElementById("openFontSettings").classList.remove("hidden");

    // Add live preview listeners
    ["Title", "Specials", "Text", "TextBold"].forEach((id) => {
      document.getElementById("fontInput" + id).addEventListener("input", () => {
        const settings = {
          title: document.getElementById("fontInputTitle").value,
          specials: document.getElementById("fontInputSpecials").value,
          text: document.getElementById("fontInputText").value,
          textBold: document.getElementById("fontInputTextBold").value,
        };
        this.setFonts(settings.title, settings.specials, settings.text, settings.textBold);
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
    this.dialog.classList.add("hidden");
    document.body.classList.remove("no-scroll");
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
    };
    localStorage.setItem("fontSettings", JSON.stringify(this.settings));
  }

  applySettings() {
    this.setFonts(this.settings.title, this.settings.specials, this.settings.text, this.settings.textBold);
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
  }

  reset() {
    if (confirm("フォント設定をリセットしてもよろしいですか？")) {
      document.getElementById("fontInputTitle").value = "";
      document.getElementById("fontInputSpecials").value = "";
      document.getElementById("fontInputText").value = "";
      document.getElementById("fontInputTextBold").value = "";
      this.save();
    }
  }

  setFonts(lclFontTitle, lclFontSpecials, lclFontText, lclFontTextBold) {
    let css = "";

    if (lclFontTitle) {
      css += this.getFontFaceCSS("myTitle", lclFontTitle);
      this.defaultTitle.href = "#";
    } else {
      this.defaultTitle.href = "./fonts/font-title.css";
    }

    if (lclFontSpecials) {
      css += this.getFontFaceCSS("mySpecials", lclFontSpecials);
      this.defaultSpecials.href = "#";
    } else {
      this.defaultSpecials.href = "./fonts/font-specials.css";
    }

    if (lclFontText) {
      css += this.getFontFaceCSS("myText", lclFontText, "normal");
      this.defaultText.href = "#";
    } else {
      this.defaultText.href = "./fonts/font-text.css";
    }

    if (lclFontTextBold) {
      css += this.getFontFaceCSS("myText", lclFontTextBold, "bold");
      this.defaultTextBold.href = "#";
    } else {
      this.defaultTextBold.href = "./fonts/font-text-bold.css";
    }

    css += this.getFontFaceCSS("myCredit", "Times New Roman", "100");

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
    document.getElementById("title").onchange();
  }
}
