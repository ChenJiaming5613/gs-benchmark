"use client";

export type ImageMetric = {
  name: string;
  value: number;
};

export type ImageCardProps = {
  image: {
    token: string;
    absolutePath: string;
  };
  metrics?: ImageMetric[];
};

export function ImageCard({ image, metrics = [] }: ImageCardProps) {
  return (
    <figure className="overflow-hidden border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <img
        src={`/api/image/${image.token}`}
        alt={image.absolutePath}
        className="w-full object-contain"
        loading="lazy"
      />
      {metrics.length > 0 && (
        <figcaption className="space-y-1 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
          <dl className="space-y-0.5">
            {metrics.map(({ name, value }) => (
              <div key={name} className="flex justify-between gap-2">
                <dt className="uppercase text-[10px] tracking-wide text-zinc-500 dark:text-zinc-500">
                  {name}
                </dt>
                <dd className="text-right font-medium text-zinc-700 dark:text-zinc-200">
                  {value.toFixed(4)}
                </dd>
              </div>
            ))}
          </dl>
        </figcaption>
      )}
    </figure>
  );
}
