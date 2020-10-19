import * as Canvas from 'canvas';
import * as fs from 'fs';

const STEP = 5;

type Pixel = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

interface Dict<T> {
  [key: string]: T;
}

type EmojiDetail = {
  r: number;
  g: number;
  b: number;
  name: string;
  char?: string;
  diff?: number;
};

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

const createEmojiDataList = async (input: Dict<string>): Promise<EmojiDetail[]> => {
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

const createEmojiDict = (data: EmojiDetail[]): Dict<EmojiDetail> => {
  const result: Dict<EmojiDetail> = {};
  data.forEach(val => {
    result[val.name] = val;
  });
  return result;
};

const createEmojiData = async () => {
  const input: Dict<string> = JSON.parse(fs.readFileSync('./emojis.json', 'utf8'));
  const dataList: EmojiDetail[] = await createEmojiDataList(input);
  const output: Dict<EmojiDetail> = createEmojiDict(dataList);
  fs.writeFile(
    './data.json',
    JSON.stringify(output, undefined, 2),
    err => console.log(err)
  );
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

const calcDistance = (
  target: {r:number, g: number, b: number},
  emoji: {r:number, g: number, b: number},
) => {
  return Math.sqrt(
    Math.pow(target.r - emoji.r, 2) +
    Math.pow(target.g - emoji.g, 2) +
    Math.pow(target.b - emoji.b, 2)
  );
};

const choiceEmoji = (r: number, g: number, b: number): EmojiDetail => {
  const data: EmojiDetail[] = JSON.parse(fs.readFileSync('./newdata.json', 'utf8'));

  let resDist: number = Infinity;
  let result: EmojiDetail | undefined = undefined;
  data.forEach((emoji, idx) => {
    console.log(`${idx} / ${data.length}`, emoji);
    if (!result) {
      result = emoji;
      resDist = calcDistance({r, g, b}, {...emoji});
    } else {
      const distance = calcDistance({r, g, b}, {...emoji});
      console.log(resDist, distance);
      if (distance < resDist) {
        result = emoji;
        resDist = distance;
      }
    }
  });

  return result ? result : data[0];
};

const main= () => {
  fs.readFile('./input/icon.png', (err, data) => {
    if (err) throw err;
    let img = new Canvas.Image;
    img.src = data;

    const ctx = Canvas.createCanvas(img.width, img.height).getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height);

    const pixels: Pixel[] = mapToPixes(ctx.getImageData(0, 0, img.width, img.height).data);
    const matrix: Pixel[][] = mapToMatrix(pixels, img.width, img.height);
    const mosaicPixel: Pixel[][] = createMosaicPixel(matrix, img.width, img.height)

    let result: string = '';
    for (let y = 0; y < mosaicPixel.length; y++) {
      for (let x = 0; x < mosaicPixel[y].length; x++) {
        const {r, g, b} = mosaicPixel[y][x];
        const emoji = choiceEmoji(r, g, b);
        result += `${emoji.char}`;
      }

      result += '\n';
    }

    console.log('result is')
    console.log(result);
  });
};

main();
