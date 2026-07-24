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
  swatch: string;
}

const BMI_BANDS: BmiBand[] = [
  { label: "Underweight", min: 0, max: 18.5, tone: "bg-[#d8e7ef]", swatch: "bg-[#b8d5e4]" },
  { label: "Healthy range", min: 18.5, max: 25, tone: "bg-[#dbe9dd]", swatch: "bg-[#9fc6a6]" },
  { label: "Overweight", min: 25, max: 30, tone: "bg-[#f4dfb2]", swatch: "bg-[#e0bd70]" },
  { label: "Obesity range", min: 30, max: 40, tone: "bg-[#efc9c0]", swatch: "bg-[#d9907e]" },
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
          <p className="text-sm text-ink/70">Height is needed before BMI can be calculated for this public profile.</p>
        </div>
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/70">
          Add height in the admin page to show BMI here.
        </div>
      </section>
    );
  }

  const scaleMax = getScaleMax(bmi);
  const currentBmiLabel =
    bmi.currentBmi !== null
      ? `Current BMI ${formatBmi(bmi.currentBmi)}${bmi.category ? `, ${bmi.category}` : ""}`
      : "Current BMI unavailable";

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">BMI meter</h2>
          <p className="text-sm text-ink/70">Calculated from current weight and height.</p>
        </div>
        <div className="rounded-2xl bg-sand/70 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/70">Height</p>
          <p className="mt-1 text-sm font-semibold text-ink">{bmi.heightCm} cm</p>
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-black/5 rounded-2xl bg-white/65 py-4">
        <div className="min-w-0 px-3 sm:px-4">
          <dt className="text-xs font-medium text-ink/70">Current</dt>
          <dd className="mt-1">
            <span className="block text-xl font-semibold tabular-nums [font-family:var(--font-heading)] text-ink sm:text-2xl">
              {bmi.currentBmi !== null ? formatBmi(bmi.currentBmi) : "--"}
            </span>
            <span className="mt-1 block text-xs text-ink/70">{bmi.category ?? "Unavailable"}</span>
          </dd>
        </div>
        <div className="min-w-0 px-3 sm:px-4">
          <dt className="text-xs font-medium text-ink/70">Start</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums [font-family:var(--font-heading)] text-ink sm:text-2xl">
            {bmi.startBmi !== null ? formatBmi(bmi.startBmi) : "--"}
          </dd>
        </div>
        <div className="min-w-0 px-3 sm:px-4">
          <dt className="text-xs font-medium text-ink/70">Target</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums [font-family:var(--font-heading)] text-ink sm:text-2xl">
            {bmi.targetBmi !== null ? formatBmi(bmi.targetBmi) : "--"}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <div
          aria-label={currentBmiLabel}
          {...(bmi.currentBmi !== null
            ? {
                "aria-valuemax": scaleMax,
                "aria-valuemin": 0,
                "aria-valuenow": bmi.currentBmi,
                "aria-valuetext": currentBmiLabel,
                role: "meter",
              }
            : { role: "img" })}
          className="relative overflow-hidden rounded-full bg-sand"
        >
          <div aria-hidden="true" className="flex h-4 w-full">
            {BMI_BANDS.map((band) => {
              const width = band.max === 40 ? scaleMax - band.min : band.max - band.min;

              return (
                <div
                  key={band.label}
                  className={band.tone}
                  style={{ width: `${(width / scaleMax) * 100}%` }}
                />
              );
            })}
          </div>

          {bmi.targetBmi !== null ? (
            <div
              className="absolute bottom-0 top-0 w-0.5 bg-ink/55"
              style={{ left: getPercent(bmi.targetBmi, scaleMax) }}
              aria-hidden="true"
            />
          ) : null}

          {bmi.currentBmi !== null ? (
            <div
              className="absolute bottom-[-4px] top-[-4px] w-1 rounded-full bg-ink"
              style={{ left: getPercent(bmi.currentBmi, scaleMax), transform: "translateX(-50%)" }}
              aria-hidden="true"
            />
          ) : null}
        </div>

        <ul aria-label="BMI ranges" className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-ink/70 sm:grid-cols-4">
          {BMI_BANDS.map((band) => (
            <li key={band.label} className="flex items-start gap-2">
              <span aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${band.swatch}`} />
              <span>
                {band.label}
                <span className="block tabular-nums text-ink/70">
                  {band.min === 0 ? `Below ${band.max}` : band.max === 40 ? `${band.min} and above` : `${band.min}–${band.max}`}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {bmi.targetBmi !== null ? (
          <p className="mt-3 text-xs text-ink/70">
            Thick marker: {currentBmiLabel}. Thin marker: target BMI {formatBmi(bmi.targetBmi)}.
          </p>
        ) : (
          <p className="mt-3 text-xs text-ink/70">Thick marker: {currentBmiLabel}.</p>
        )}
      </div>
    </section>
  );
}
