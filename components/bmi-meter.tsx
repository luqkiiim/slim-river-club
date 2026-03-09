import { formatBmi } from "@/lib/weight-utils";
import type { BmiSummary } from "@/types/app";

interface BmiMeterProps {
  bmi: BmiSummary;
}

interface BmiBand {
  label: string;
  min: number;
  max: number;
  tone: string;
}

const BMI_BANDS: BmiBand[] = [
  { label: "Under", min: 0, max: 18.5, tone: "bg-[#d8e7ef] text-[#34566c]" },
  { label: "Healthy", min: 18.5, max: 25, tone: "bg-[#dbe9dd] text-moss" },
  { label: "Over", min: 25, max: 30, tone: "bg-[#f4dfb2] text-[#7f5b17]" },
  { label: "Obese", min: 30, max: 40, tone: "bg-[#efc9c0] text-[#8f4a36]" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getScaleMax(bmi: BmiSummary) {
  return Math.max(40, Math.ceil(Math.max(bmi.startBmi ?? 0, bmi.currentBmi ?? 0, bmi.targetBmi ?? 0, 35)));
}

function getPercent(value: number, scaleMax: number) {
  return `${clamp((value / scaleMax) * 100, 0, 100)}%`;
}

export function BmiMeter({ bmi }: BmiMeterProps) {
  if (bmi.heightCm === null) {
    return (
      <section className="panel p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">BMI meter</h2>
          <p className="text-sm text-ink/65">Height is needed before BMI can be calculated for this public profile.</p>
        </div>
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
          Add height in the admin page to show BMI here.
        </div>
      </section>
    );
  }

  const scaleMax = getScaleMax(bmi);

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">BMI meter</h2>
          <p className="text-sm text-ink/65">Calculated from current weight and height.</p>
        </div>
        <div className="rounded-2xl bg-sand/70 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Height</p>
          <p className="mt-1 text-sm font-semibold text-ink">{bmi.heightCm} cm</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Current BMI</p>
          <p className="mt-2 text-2xl font-semibold [font-family:var(--font-heading)] text-ink">
            {bmi.currentBmi !== null ? formatBmi(bmi.currentBmi) : "--"}
          </p>
          <p className="mt-1 text-sm text-ink/65">{bmi.category ?? "Unavailable"}</p>
        </div>
        <div className="panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Start BMI</p>
          <p className="mt-2 text-2xl font-semibold [font-family:var(--font-heading)] text-ink">
            {bmi.startBmi !== null ? formatBmi(bmi.startBmi) : "--"}
          </p>
        </div>
        <div className="panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Target BMI</p>
          <p className="mt-2 text-2xl font-semibold [font-family:var(--font-heading)] text-ink">
            {bmi.targetBmi !== null ? formatBmi(bmi.targetBmi) : "--"}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="relative overflow-hidden rounded-full bg-sand">
          <div className="flex h-4 w-full">
            {BMI_BANDS.map((band) => {
              const width = band.max === 40 ? scaleMax - band.min : band.max - band.min;

              return (
                <div
                  key={band.label}
                  className={band.tone}
                  style={{ width: `${(width / scaleMax) * 100}%` }}
                  title={`${band.label}: ${band.min} - ${band.max}`}
                />
              );
            })}
          </div>

          {bmi.targetBmi !== null ? (
            <div
              className="absolute bottom-0 top-0 w-0.5 bg-ink/55"
              style={{ left: getPercent(bmi.targetBmi, scaleMax) }}
              title={`Target BMI ${formatBmi(bmi.targetBmi)}`}
            />
          ) : null}

          {bmi.currentBmi !== null ? (
            <div
              className="absolute bottom-[-4px] top-[-4px] w-1 rounded-full bg-ink"
              style={{ left: getPercent(bmi.currentBmi, scaleMax), transform: "translateX(-50%)" }}
              title={`Current BMI ${formatBmi(bmi.currentBmi)}`}
            />
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/55">
          <span>18.5 underweight threshold</span>
          <span>25 healthy upper bound</span>
          <span>30 obesity threshold</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-ink/60">
          <span>Current marker: thick dark line</span>
          <span>Target marker: thin line</span>
        </div>
      </div>
    </section>
  );
}
