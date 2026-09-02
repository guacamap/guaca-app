export function RailArt() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden lg:block" aria-hidden="true">
      <img
        src="/assets/rail-palm.webp"
        alt=""
        className="block w-full"
        style={{ maskImage: 'linear-gradient(to bottom, transparent, black 28%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 28%)' }}
      />
    </div>
  )
}
