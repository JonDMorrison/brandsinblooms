import * as React from "react";

interface BloomVoiceWaveformProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  barColor?: string;
  barWidth?: number;
  barGap?: number;
  barMinHeight?: number;
  barMaxHeight?: number;
}

const resolveCanvasColor = (canvas: HTMLCanvasElement, color: string) => {
  const variableMatch = color.match(/^var\((--[^)]+)\)$/);
  if (!variableMatch) {
    return color;
  }

  const resolved = getComputedStyle(canvas)
    .getPropertyValue(variableMatch[1])
    .trim();
  return resolved || color;
};

const drawRoundedBar = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const radius = Math.min(width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height,
  );
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fill();
};

export function BloomVoiceWaveform({
  analyserNode,
  isRecording,
  barColor = "var(--joy-palette-neutral-700)",
  barWidth = 2,
  barGap = 2,
  barMinHeight = 2,
  barMaxHeight = 28,
}: BloomVoiceWaveformProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const dataArrayRef = React.useRef<Uint8Array | null>(null);
  const dimensionsRef = React.useRef({ width: 0, height: 32, pixelRatio: 1 });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height || 32);

      dimensionsRef.current = { width, height, pixelRatio };
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);

      const context = canvas.getContext("2d");
      context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return undefined;
    }

    const fillColor = resolveCanvasColor(canvas, barColor);

    const drawFrame = () => {
      const { width, height } = dimensionsRef.current;
      const barStep = barWidth + barGap;
      const barCount = Math.max(1, Math.floor(width / barStep));
      const usableWidth = barCount * barWidth + (barCount - 1) * barGap;
      const startX = Math.max(0, (width - usableWidth) / 2);
      const now = performance.now();

      if (analyserNode) {
        if (
          !dataArrayRef.current ||
          dataArrayRef.current.length !== analyserNode.frequencyBinCount
        ) {
          dataArrayRef.current = new Uint8Array(analyserNode.frequencyBinCount);
        }
        analyserNode.getByteFrequencyData(dataArrayRef.current);
      }

      const dataArray = dataArrayRef.current;
      context.clearRect(0, 0, width, height);
      context.fillStyle = fillColor;

      for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
        const dataIndex = dataArray
          ? Math.min(
              dataArray.length - 1,
              Math.floor(
                (barIndex / Math.max(1, barCount - 1)) * (dataArray.length - 1),
              ),
            )
          : 0;
        const amplitude = dataArray ? dataArray[dataIndex] / 255 : 0;
        const responsiveHeight =
          barMinHeight + amplitude * (barMaxHeight - barMinHeight);
        const idleHeight =
          barMinHeight + Math.max(0, Math.sin(now / 300 + barIndex * 0.3)) * 2;
        const barHeight = Math.min(
          barMaxHeight,
          Math.max(responsiveHeight, idleHeight),
        );
        const x = startX + barIndex * barStep;
        const y = (height - barHeight) / 2;

        drawRoundedBar(context, x, y, barWidth, barHeight);
      }

      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(drawFrame);
      }
    };

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(drawFrame);
    } else {
      drawFrame();
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    analyserNode,
    barColor,
    barGap,
    barMaxHeight,
    barMinHeight,
    barWidth,
    isRecording,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: 32 }}
    />
  );
}
