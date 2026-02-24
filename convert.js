const fs = require("fs");

// raw.txt 파일 읽기
const text = fs.readFileSync("raw.txt", "utf-8");

// 줄 단위 분리
const lines = text
  .split("\n")
  .map(line => line.trim())
  .filter(line => line !== "");

let result = [];

for (let i = 0; i < lines.length; i += 2) {
  const word = lines[i];
  const meaningLine = lines[i + 1];

  if (!meaningLine) continue;

  // ① ② ③ 제거
  const cleanedMeaning = meaningLine.replace(/①|②|③|④/g, "");

  // , 또는 ; 기준으로 나누기
  const meanings = cleanedMeaning
    .split(/,|;/)
    .map(m => m.trim())
    .filter(m => m !== "");

  result.push({
    word: word,
    meanings: meanings
  });
}

// words.json 생성
fs.writeFileSync("words.json", JSON.stringify(result, null, 2), "utf-8");

console.log("변환 완료 ✔ words.json 생성됨");