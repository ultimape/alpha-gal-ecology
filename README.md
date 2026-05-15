# The Tick, the Coyote, and the Deer

An interactive essay about Lotka–Volterra predator–prey dynamics, the alpha-gal syndrome carried by lone star ticks, and what happens to a deer herd when its apex predator can no longer eat it.

**[Live essay →](https://ultimape.github.io/alpha-gal-ecology/)**

<!-- Optional: add a screenshot. -->
<!-- ![Preview of the master simulation](preview.png) -->

---

## What this is

A single-page interactive essay (one HTML file, ~80 KB, no dependencies, no tracking, works offline). It builds up a small ecological model in pieces — exponential growth, logistic ceiling, classical Lotka–Volterra cycles, a tick-driven predator collapse, density-dependent disease, and a configurable suffering metric — with every parameter exposed as a slider.

The thesis: **removing a predator doesn't remove the pressure on its prey. It changes the currency.** Predation deaths get replaced by slow deaths from disease and starvation. Whether that's better or worse depends on ethical weights you can assign yourself.

## What's inside

- **One HTML file** — `index.html`. CSS, math, and the simulation engine are all inlined. Drop it on GitHub Pages and it just works.
- **Vanilla JS** — no React, no D3, no Plotly. Charts are drawn on `<canvas>` with HiDPI support. The ODE solver is a four-state RK4 integrator. ~1000 lines.
- **Colorblind-safe palette** — based on Okabe & Ito (2008). The critical predator/prey color pair is distinguishable for all common forms of color vision deficiency.
- **Mobile-friendly** — figures break out wider on big screens (up to ~1340px) while prose stays in a comfortable 760px reading column. Phone layouts use tighter padding and smaller fonts. Canvas heights scale with viewport via `clamp()`.

## The model

The full simulation tracks three coupled ODEs:

```
dx/dt = α·x·(1 − (1−E)·x/K)            [growth, gated logistic]
       − β·E·x·y                        [effective predation]
       − τ·z(t)·x                       [tick parasitism on deer]
       − [s·max(0,x/K_safe−1)² + d·(x/K_safe)ⁿ]·(1−E)·x   [density-dep. disease/starv]
       − h·x                            [human harvest]

dy/dt = δ·E·x·y − γ·y                   [predator dynamics, effective]

dE/dt = −μ·z(t)·E                       [alpha-gal sensitization, permanent]
```

`z(t)` is a Gaussian tick bloom centered on time `T` with width `w`. The predator-effectiveness state variable `E` decays during the bloom and never recovers — alpha-gal sensitization is permanent — and it gates the post-bloom logistic damping and density-dependent disease so that pre-bloom Lotka–Volterra cycles stay perfectly stable.

The suffering function is a weighted sum of five different kinds of dying:

```
S(t) = w₁·predation + w₂·starvation + w₃·disease + w₄·stress + w₅·hunting
```

Ethical presets (Utilitarian, Ecological, Animal Welfare, Anti-Hunting, Hunter Compensation) preset the weights; the sliders let you set your own. The readout shows mean suffering rates per year before and after the tick event, so the comparison is independent of how long you let the simulation run.

## Running locally

```bash
git clone https://github.com/ultimape/alpha-gal-ecology.git
cd tick-coyote-deer
open index.html         # or just double-click
```

That's it. No build step. No package manager. No server required.

## Modifying

The deployed `index.html` is built from two sources:

- `template.html` — the prose, CSS, and HTML skeleton, with a `/* JAVASCRIPT_GOES_HERE */` placeholder.
- `app.js` — the simulation engine, chart class, and UI wiring.

To rebuild after edits:

```bash
python3 build.py     # inlines app.js into template.html → index.html
```

## Publishing on GitHub Pages

1. Push the repo to GitHub.
2. **Settings → Pages**, set **Source** to **Deploy from a branch**, **Branch** to `main` (root).
3. Wait ~30 seconds for the deploy.
4. Live at `https://ultimape.github.io/alpha-gal-ecology/`.

## Caveats

The scenario the essay rests on — alpha-gal jumping the species barrier into wild carnivores — is speculative. The textbook reason it can't happen (non-primate mammals make alpha-gal as a self-molecule, so they're immune-tolerant to it) is shakier than it first appears; a 2019 study (Hodžić et al., *Vaccines* 7:114) found tick bites do induce anti-α-Gal antibodies in dogs, which should theoretically be tolerant. Whether that translates to a functional meat allergy in a wild canid is unknown. The model itself is a stand-in for any pressure that removes an apex predator — a novel pathogen, a habitat collapse, a hunting policy change. The math doesn't care about the cause; it cares about the absence.

Real ecosystems also have more than two species, more than one limiting resource, weather, geography, delayed feedbacks, and the unpredictable. Toy models miss all of that. What they get right is the *shape* of an argument. The shape this one shows is one worth seeing.

## License

The code and essay are released under the [MIT License](LICENSE). Use, modify, fork, and republish freely.

## Citation

If you reference this essay academically:

> *The Tick, the Coyote, and the Deer: An Interactive Essay on Predator–Prey Dynamics and Suffering* (2026). https://ultimape.github.io/alpha-gal-ecology/

For the underlying biology and ecology, see the in-essay footnotes.
