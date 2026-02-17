export const VideoShowcaseSection = () => {
  return (
    <section className="py-24 px-6 bg-offwhite">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-4xl font-bold mb-4 text-accent">
          Built to Help Garden Centers Thrive All Year Long
        </h2>
        <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
          See how BloomSuite brings together everything you need to grow your garden center business — in one simple platform.
        </p>
        <div className="aspect-video rounded-2xl shadow-xl overflow-hidden">
          <iframe
            src="https://player.vimeo.com/video/1165759043?badge=0&autopause=0&player_id=0"
            className="w-full h-full"
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="BloomSuite Overview"
          />
        </div>
      </div>
    </section>
  );
};
