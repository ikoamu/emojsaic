import * as Canvas from 'canvas';
import * as fs from 'fs';

const STEP = 1;

type Pixel = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

type EmojiData = {
  name: string;
  r: number;
  g: number;
  b: number;
};

interface Dict<T> {
  [key: string]: T;
}

const mapToPixes = (data: Uint8ClampedArray): Pixel[] => {
  const pixels: Pixel[] = [];
  for (let i = 0; i <= data.length - 4; i += 4) {
    pixels.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
      a: data[i + 3],
    });
  }

  return pixels;
}

const mapToMatrix = (pixels: Pixel[], imgWidth: number, imgHeight: number): Pixel[][] => {
  const matrix: Pixel[][] = [];

  let i = 0;
  for (let y = 0; y < imgHeight; y++) {
    const line: Pixel[] = [];
    for (let x = 0; x < imgWidth; x++) {
      line.push(pixels[i]);
      i++;
    }

    matrix.push(line);
  }

  return matrix;
}

const calcAvg = (matrix: Pixel[][], x: number, y: number): Pixel => {
  let count = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let i = y; i < y + STEP; i++) {
    for (let j = x; j < x + STEP; j++) {
      const p = matrix[i][j];
      if (p.a !== 0) {
        count++;
        sumG += p.g;
        sumB += p.b;
        sumR += p.r;
      }
    }
  }

  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count),
  }
};

const createMosaicPixel = (
  matrix: Pixel[][], imgWidth: number, imgHeight: number,
): Pixel[][] => {
  const mosaicPixel: Pixel[][] = [];

  for (let y = 0; y <= imgHeight - STEP; y += STEP) {
    const line: Pixel[] = [];
    for (let x = 0; x <= imgWidth - STEP; x += STEP) {
      line.push(calcAvg(matrix, x, y));
    }
    mosaicPixel.push(line);
  }

  return mosaicPixel;
}

const createMosaicPng = (
  mosaicPixel: Pixel[][], imgWidth: number, imgHeight: number,
) => {
  const canvas = Canvas.createCanvas(imgWidth, imgHeight);
  const ctx = canvas.getContext('2d');

  mosaicPixel.map((pxls, h) => {
    pxls.map((p, w) => {
      ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      ctx.fillRect(w * STEP, h * STEP, (w + 1) * STEP, (h + 1) * STEP);
      ctx.closePath();
    });
  });

  const out = fs.createWriteStream('./out.png');
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  out.on('finish', () => console.log('done'));
};

const mosaTest = () => {
  fs.readFile('./input/IMG_5052.JPG', (err, data) => {
    if (err) throw err;
    let img = new Canvas.Image;
    img.src = data;

    const ctx = Canvas.createCanvas(img.width, img.height).getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height);

    const pixels: Pixel[] = mapToPixes(ctx.getImageData(0, 0, img.width, img.height).data);
    const matrix: Pixel[][] = mapToMatrix(pixels, img.width, img.height);
    const mosaicPixel: Pixel[][] = createMosaicPixel(matrix, img.width, img.height)
    createMosaicPng(mosaicPixel, img.width, img.height);
  });
};

const calcEmojiAvg = (matrix: Pixel[][], imgWidth: number, imgHeight: number): Pixel => {
  let count = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let i = 0; i < imgHeight; i++) {
    for (let j = 0; j < imgWidth; j++) {
      const p = matrix[i][j];
      if (p.a !== 0) {
        count++;
        sumG += p.g;
        sumB += p.b;
        sumR += p.r;
      }
    }
  }

  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count),
  }
};

const createEmojiDataList = async (input: Dict<string>): Promise<EmojiData[]> => {
  return Promise.all(Object.keys(input).map(async (val, idx) => {
    return await Canvas.loadImage(input[val]).then(img => {
      const ctx = Canvas.createCanvas(img.width, img.height).getContext('2d');
      ctx.drawImage(img, 0, 0, img.width, img.height);
      const pixels: Pixel[] = mapToPixes(ctx.getImageData(0, 0, img.width, img.height).data);
      const matrix: Pixel[][] = mapToMatrix(pixels, img.width, img.height);
      return {
        name: val,
        ...calcEmojiAvg(matrix, img.width, img.height),
      };
    }).finally(() => console.log(idx));
  }));
};

const createEmojiDict = (data: EmojiData[]): Dict<EmojiData> => {
  const result: Dict<EmojiData> = {};
  data.forEach(val => {
    result[val.name] = val;
  });
  return result;
};

const main = async () => {
  const input: Dict<string> = JSON.parse(fs.readFileSync('./emojis.json', 'utf8'));
  const dataList: EmojiData[] = await createEmojiDataList(input);
  const output: Dict<EmojiData> = createEmojiDict(dataList);
  fs.writeFile(
    './data.json',
    JSON.stringify(output, undefined, 2),
    err => console.log(err)
  );
};

main();
