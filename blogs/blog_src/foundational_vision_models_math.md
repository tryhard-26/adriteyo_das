# The Math behind Foundational Vision Models

Modern vision models look very different from classical convolutional networks. Instead of baking spatial locality and translation equivariance directly into sliding kernels, architectures like ViT, DINOv2, SAM, SigLIP, NaViT, and PaliGemma 2 rely on sequence tokenization, self-supervised distillation, promptable segmentation, and unified autoregressive loss formulations.

This guide walks through the core mathematical machinery, physical intuition, and concrete worked-out calculations behind modern vision architectures: patch projection geometry, 2D rotary position embeddings, the dynamics of self-distillation collapse prevention, prompt Fourier encodings in Segment Anything, pairwise sigmoid loss in SigLIP, and how Vision-Language Models (VLMs) evolved from global vector pooling to unified token sequences.

## 1. Spatial tokenization: patch projection geometry

A standard 2D convolution assumes that nearby pixels have stronger statistical dependencies than distant pixels (locality) and that patterns appear identically across spatial shifts (translation equivariance). Vision Transformers drop both structural constraints from the layer definition. The network learns spatial correlations directly from training data.

<div class="svg-diagram">
<svg viewBox="0 0 760 210" class="diagram-svg" xmlns="http://www.w3.org/2000/svg">
  <rect x="15" y="45" width="110" height="110" rx="8" fill="#0c0a15" stroke="#10b981" stroke-width="2"/>
  <text x="70" y="95" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">RAW IMAGE</text>
  <text x="70" y="115" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="11" text-anchor="middle">H x W x C</text>
  <path d="M 130 100 L 165 100" stroke="#06b6d4" stroke-width="2" marker-end="url(#arrow)"/>
  <rect x="170" y="45" width="130" height="110" rx="8" fill="#0c0a15" stroke="#06b6d4" stroke-width="2"/>
  <text x="235" y="90" fill="#06b6d4" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">PATCH GRID</text>
  <text x="235" y="110" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="11" text-anchor="middle">N = (H·W)/P²</text>
  <text x="235" y="128" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">P x P x C</text>
  <path d="M 305 100 L 340 100" stroke="#fbbf24" stroke-width="2"/>
  <rect x="345" y="45" width="145" height="110" rx="8" fill="#0c0a15" stroke="#fbbf24" stroke-width="2"/>
  <text x="417" y="90" fill="#fbbf24" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">LINEAR PROJECTION</text>
  <text x="417" y="110" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="11" text-anchor="middle">Matrix E: (P²·C) -> D</text>
  <text x="417" y="128" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">stride P conv</text>
  <path d="M 495 100 L 530 100" stroke="#f43f5e" stroke-width="2"/>
  <rect x="535" y="45" width="190" height="110" rx="8" fill="#0c0a15" stroke="#f43f5e" stroke-width="2"/>
  <text x="630" y="85" fill="#f43f5e" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">TRANSFORMER TOKENS</text>
  <text x="630" y="105" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="11" text-anchor="middle">z₀ = [CLS; x_p E] + E_pos</text>
  <text x="630" y="125" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Shape: (N + 1) x D</text>
</svg>
</div>

### The linear projection equation

Take an input image $\mathbf{X} \in \mathbb{R}^{H \times W \times C}$, where $H$ is height, $W$ is width, and $C$ is channel depth (3 for standard RGB):

1. The image is split into non-overlapping patches of spatial dimension $P \times P$.
2. The sequence length $N$ (the number of patch tokens) is:

$$N = \frac{H \cdot W}{P^2}$$

1. Each patch $\mathbf{x}_p^{(i)}$ is flattened into a 1D vector of dimension $P^2 \cdot C$:

$$\mathbf{x}_p^{(i)} \in \mathbb{R}^{P^2 \cdot C}, \quad i \in \{1, \dots, N\}$$

1. The flattened vector maps into hidden dimension $D$ through a projection matrix $\mathbf{E} \in \mathbb{R}^{(P^2 \cdot C) \times D}$ and optional bias $\mathbf{b}_e \in \mathbb{R}^D$:

$$\mathbf{z}_0 = \left[ \mathbf{x}_{\text{class}}; \ \mathbf{x}_p^{(1)}\mathbf{E}; \ \mathbf{x}_p^{(2)}\mathbf{E}; \ \dots; \ \mathbf{x}_p^{(N)}\mathbf{E} \right] + \mathbf{E}_{\text{pos}}$$

Here $\mathbf{x}_{\text{class}} \in \mathbb{R}^D$ is the prepended learnable `[CLS]` token, and $\mathbf{E}_{\text{pos}} \in \mathbb{R}^{(N + 1) \times D}$ is the positional encoding matrix.

Mathematically, this linear projection is equivalent to a single 2D convolutional layer where kernel size is $P \times P$, stride is $P$, and output channel count is $D$. It discretizes continuous spatial pixels into an ordered sequence of vector embeddings.

### Computational complexity and the quadratic bottleneck

In multi-head self-attention (MHSA), queries $\mathbf{Q}$, keys $\mathbf{K}$, and values $\mathbf{V}$ come from projection matrices $\mathbf{W}_Q, \mathbf{W}_K, \mathbf{W}_V \in \mathbb{R}^{D \times D}$:

$$\mathbf{Q} = \mathbf{Z} \mathbf{W}_Q, \quad \mathbf{K} = \mathbf{Z} \mathbf{W}_K, \quad \mathbf{V} = \mathbf{Z} \mathbf{W}_V$$

The attention equation is:

$$\text{Attention}(\mathbf{Q}, \mathbf{K}, \mathbf{V}) = \text{softmax}\left( \frac{\mathbf{Q}\mathbf{K}^\top}{\sqrt{d_k}} \right) \mathbf{V}$$

For sequence length $N$ and hidden dimension $D$, the FLOP cost per layer breaks down as follows:

* Projections for $\mathbf{Q}, \mathbf{K}, \mathbf{V}$ require $3 \times (2 N D^2) = 6 N D^2$ floating point operations.
* The attention matrix product $\mathbf{Q}\mathbf{K}^\top$ multiplies $(N \times D)$ by $(D \times N)$, costing $2 N^2 D$ FLOPs.
* Softmax scaling requires roughly $3 N^2$ operations.
* Multiplying attention weights by values, $\mathbf{A}\mathbf{V}$, costs $2 N^2 D$ FLOPs.
* The final output projection adds $2 N D^2$ FLOPs.

Summing these terms gives the per-layer cost:

$$\text{FLOPs}_{\text{layer}} \approx 8 N D^2 + 4 N^2 D$$

The intuition behind this cost lies in the dependency on patch size $P$. Because $N = \frac{HW}{P^2}$, halving the patch size from $P=16$ to $P=8$ quadruples the token count:

$$N \to 4N$$

The quadratic term $4 N^2 D$ scales as:

$$4(4N)^2 D = 16 \cdot (4 N^2 D)$$

A $2\times$ reduction in patch granularity increases attention computation and intermediate activation memory by a factor of 16. That is why backbones like ViT-H, SAM, and SigLIP pre-train at $P=14$ or $P=16$, using $P=8$ only for dense fine-tuning.

### Stepping through the numbers: how patch size blows up FLOPs

Let us calculate an explicit case with actual numbers: take an input image with height $H=4$, width $W=4$, and channels $C=3$, feeding into a transformer with hidden dimension $D=6$.

First, choose patch size $P=2$:

* Number of patches: $N = \frac{4 \times 4}{2^2} = \frac{16}{4} = 4$ patches.
* Each patch contains $2 \times 2 \times 3 = 12$ raw pixel numbers.
* The projection matrix $\mathbf{E}$ has shape $(12 \times 6)$.
* Multiplying the 4 flattened patches by $\mathbf{E}$ yields a token sequence of shape $(4 \times 6)$.
* FLOPs per attention layer:
  $$8 N D^2 + 4 N^2 D = 8(4)(36) + 4(16)(6) = 1152 + 384 = 1536 \text{ FLOPs}$$

Now cut the patch size in half to $P=1$:

* Number of patches: $N = \frac{4 \times 4}{1^2} = 16$ patches ($4\times$ increase).
* Each patch is $1 \times 1 \times 3 = 3$ pixels.
* The attention matrix $\mathbf{Q}\mathbf{K}^\top$ is now $(16 \times 16) = 256$ entries instead of $(4 \times 4) = 16$ entries.
* The attention FLOP cost jumps:
  $$4 N^2 D = 4(16^2)(6) = 4(256)(6) = 6144 \text{ FLOPs}$$
  Notice that $6144 / 384 = 16$. The attention computation scaled by an exact factor of 16.

<figure class="interactive-fig" id="fig-patch-scaling">
  <div class="fig-card">
    <div class="fig-header">
      <span class="fig-title">Patch Granularity & Quadratic Attention Cost</span>
      <span class="fig-status" id="patch-stats-badge">N = 196 tokens · Matrix = 38.4k cells</span>
    </div>
    <svg id="patch-scaling-svg" viewBox="0 0 680 260" class="fig-svg" xmlns="http://www.w3.org/2000/svg">
      <!-- Rendered dynamically by script -->
    </svg>
    <div class="fig-toolbar">
      <div class="toolbar-group">
        <span class="toolbar-label">Patch Size (P)</span>
        <div class="btn-group" id="patch-btn-group">
          <button type="button" class="fig-btn" data-patch="32">32×32</button>
          <button type="button" class="fig-btn active" data-patch="16">16×16</button>
          <button type="button" class="fig-btn" data-patch="8">8×8</button>
          <button type="button" class="fig-btn" data-patch="4">4×4</button>
        </div>
      </div>
      <div class="toolbar-group">
        <span class="toolbar-label">Resolution</span>
        <div class="btn-group" id="res-btn-group">
          <button type="button" class="fig-btn active" data-res="224">224px</button>
          <button type="button" class="fig-btn" data-res="384">384px</button>
          <button type="button" class="fig-btn" data-res="512">512px</button>
        </div>
      </div>
    </div>
  </div>
  <figcaption class="fig-caption">Fig 1.1: Halving patch size quadruples sequence length N and scales pairwise self-attention memory by sixteen-fold.</figcaption>
</figure>

This 16-fold scaling explosion explains why training Vision Transformers on high-resolution images is computationally brutal. Suppose an autonomous driving camera upgrades from 1080p ($1920 \times 1080 \approx 2.1\text{M}$ pixels) to 4K ($3840 \times 2160 \approx 8.3\text{M}$ pixels). The raw pixel count quadruples ($4\times$). But because patch size $P$ stays fixed at $14 \times 14$, the token count also quadruples ($N \to 4N$). Because standard self-attention evaluates pairwise affinities between every token and every other token, the attention matrix scales quadratically: $(4N)^2 = 16N^2$. Compute and intermediate activation memory do not increase four-fold; they explode sixteen-fold. This is the physical reason why architectures like ViT, SAM, and SigLIP keep patch sizes relatively large during pre-training, or rely on windowed local attention.

## 2. 2D positional geometry: learned embeddings vs 2D-RoPE

In language models, tokens follow a 1D sequence index. In vision, flattening a 2D grid into a 1D sequence separates vertically adjacent patches: patch $(i, j)$ and patch $(i+1, j)$ end up separated by an offset of $W/P$ tokens in the sequence.

### 1D learned embeddings and bicubic interpolation

Standard ViT adds learned 1D vectors $\mathbf{e}_i \in \mathbb{R}^D$ to input tokens. When input resolution increases during fine-tuning (for example, moving from $224 \times 224$ to $448 \times 448$), the sequence length expands from 196 to 784 tokens.

To adapt pre-trained positional embeddings to the larger grid, ViT applies 2D bicubic spline interpolation:

$$\mathbf{E}_{\text{pos}}^{2D}(x, y) = \sum_{k=0}^3 \sum_{l=0}^3 a_{k, l} \, x^k y^l$$

While this interpolation fits new coordinates to the learned grid, the representation remains tied to absolute coordinates rather than relative spatial distance.

### 2D rotary position embeddings (2D-RoPE)

Modern backbones adapt Rotary Position Embeddings (RoPE) to two dimensions. Instead of adding vectors to token inputs, 2D-RoPE rotates query and key vectors in the complex plane based on their 2D coordinates $(m_x, m_y)$.

<div class="svg-diagram">
<svg viewBox="0 0 720 180" class="diagram-svg" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="40" width="130" height="95" rx="8" fill="#0c0a15" stroke="#06b6d4" stroke-width="2"/>
  <text x="85" y="80" fill="#06b6d4" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">QUERY q ∈ ℝᵈ</text>
  <text x="85" y="100" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">dim d per head</text>
  <path d="M 155 87 L 195 87" stroke="#06b6d4" stroke-width="2"/>
  <rect x="200" y="25" width="140" height="55" rx="6" fill="#0c0a15" stroke="#10b981" stroke-width="1.5"/>
  <text x="270" y="55" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="bold" text-anchor="middle">X-Subspace (d/2)</text>
  <text x="270" y="70" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Rotate by R_x(m_x)</text>
  <rect x="200" y="95" width="140" height="55" rx="6" fill="#0c0a15" stroke="#fbbf24" stroke-width="1.5"/>
  <text x="270" y="125" fill="#fbbf24" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="bold" text-anchor="middle">Y-Subspace (d/2)</text>
  <text x="270" y="140" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Rotate by R_y(m_y)</text>
  <path d="M 345 52 L 385 75" stroke="#10b981" stroke-width="1.5"/>
  <path d="M 345 122 L 385 95" stroke="#fbbf24" stroke-width="1.5"/>
  <rect x="390" y="40" width="140" height="95" rx="8" fill="#0c0a15" stroke="#f43f5e" stroke-width="2"/>
  <text x="460" y="80" fill="#f43f5e" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">ROTATED q</text>
  <text x="460" y="100" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">[q_x rot; q_y rot]</text>
  <path d="M 535 87 L 575 87" stroke="#f43f5e" stroke-width="2"/>
  <rect x="580" y="40" width="125" height="95" rx="8" fill="#0c0a15" stroke="#10b981" stroke-width="2"/>
  <text x="642" y="80" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">INNER PRODUCT</text>
  <text x="642" y="100" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">depends on Δp</text>
</svg>
</div>

The mathematical intuition behind RoPE is Euler's formula:

$$e^{i \theta_u} \cdot e^{-i \theta_v} = e^{i(\theta_u - \theta_v)}$$

When multiplying two complex numbers, their angles subtract. By encoding coordinates as rotation angles, the inner product between query and key vectors depends strictly on their coordinate difference rather than their absolute positions.

For head dimension $d$, the channel space splits into two equal parts of size $d/2$: one for the horizontal axis $x$, and one for the vertical axis $y$.

For coordinate $(m_x, m_y)$, the 2D rotary operator $\mathbf{R}_{(m_x, m_y)}$ forms a block-diagonal matrix:

$$\mathbf{R}_{(m_x, m_y)} = \begin{pmatrix} \mathbf{R}_{m_x} & \mathbf{0} \\ \mathbf{0} & \mathbf{R}_{m_y} \end{pmatrix}$$

Each sub-matrix $\mathbf{R}_{m}$ rotates consecutive coordinate pairs by angle $m \theta_k$:

$$\mathbf{R}_m^{(k)} = \begin{pmatrix} \cos(m \theta_k) & -\sin(m \theta_k) \\ \sin(m \theta_k) & \cos(m \theta_k) \end{pmatrix}, \quad \theta_k = 10000^{-2(k-1)/d_s}$$

Evaluating attention between query $\mathbf{q}$ at position $\mathbf{u} = (u_x, u_y)$ and key $\mathbf{k}$ at position $\mathbf{v} = (v_x, v_y)$ yields:

$$\langle \mathbf{R}_{\mathbf{u}} \mathbf{q}, \ \mathbf{R}_{\mathbf{v}} \mathbf{k} \rangle = (\mathbf{R}_{\mathbf{u}} \mathbf{q})^\top (\mathbf{R}_{\mathbf{v}} \mathbf{k}) = \mathbf{q}^\top \mathbf{R}_{\mathbf{u}}^\top \mathbf{R}_{\mathbf{v}} \mathbf{k} = \mathbf{q}^\top \mathbf{R}_{\mathbf{u} - \mathbf{v}} \mathbf{k}$$

Because 2D rotation matrices belong to the orthogonal group $\text{SO}(2)$ where $\mathbf{R}_\mathbf{u}^\top \mathbf{R}_\mathbf{v} = \mathbf{R}_{\mathbf{u} - \mathbf{v}}$, the inner product depends strictly on the spatial offset vector:

$$\Delta \mathbf{p} = (u_x - v_x, \ u_y - v_y)$$

The attention operation retains translation equivariance across the 2D plane regardless of input image dimensions.

### Stepping through the numbers: verifying coordinate cancellation

Let head dimension $d=4$. The subspace for $x$ has dimension 2, and the subspace for $y$ has dimension 2.

Take two patches:

* Patch A (Query $\mathbf{q}$) is located at coordinate $\mathbf{u} = (x=0, y=1)$.
* Patch B (Key $\mathbf{k}$) is located at coordinate $\mathbf{v} = (x=2, y=3)$.

Let the rotation angle multiplier be $\theta = \frac{\pi}{2}$ (90 degrees).

Compute the rotation angles for Patch A at $(0, 1)$:

* $x$-rotation: $0 \cdot \theta = 0$. The rotation matrix is identity $\begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix}$.
* $y$-rotation: $1 \cdot \theta = \frac{\pi}{2}$. The rotation matrix is $\begin{pmatrix} \cos(\pi/2) & -\sin(\pi/2) \\ \sin(\pi/2) & \cos(\pi/2) \end{pmatrix} = \begin{pmatrix} 0 & -1 \\ 1 & 0 \end{pmatrix}$.

Compute the rotation angles for Patch B at $(2, 3)$:

* $x$-rotation: $2 \cdot \theta = \pi$. The matrix is $\begin{pmatrix} -1 & 0 \\ 0 & -1 \end{pmatrix}$.
* $y$-rotation: $3 \cdot \theta = \frac{3\pi}{2}$. The matrix is $\begin{pmatrix} 0 & 1 \\ -1 & 0 \end{pmatrix}$.

Now look at the combined relative transformation in the $y$-subspace:
$$\mathbf{R}_{y, \mathbf{u}}^\top \mathbf{R}_{y, \mathbf{v}} = \begin{pmatrix} 0 & 1 \\ -1 & 0 \end{pmatrix} \begin{pmatrix} 0 & 1 \\ -1 & 0 \end{pmatrix} = \begin{pmatrix} -1 & 0 \\ 0 & -1 \end{pmatrix}$$
Notice that $\begin{pmatrix} -1 & 0 \\ 0 & -1 \end{pmatrix}$ is the exact rotation matrix for angle $\Delta y \cdot \theta = (3 - 1) \frac{\pi}{2} = \pi$.

Even if both patches shift by 100 pixels along the image (say to $(100, 101)$ and $(102, 103)$), the difference remains $(2, 2)$, and the resulting attention score is identical.

<figure class="interactive-fig" id="fig-rope-explorer">
  <div class="fig-card">
    <div class="fig-header">
      <span class="fig-title">2D Rotary Embeddings: Translation Equivariance in SO(2)</span>
      <span class="fig-status" id="rope-stats-badge">Δp = (2, 2) · Inner Product = Invariant</span>
    </div>
    <svg id="rope-svg" viewBox="0 0 680 230" class="fig-svg" xmlns="http://www.w3.org/2000/svg">
      <!-- Rendered dynamically by script -->
    </svg>
    <div class="fig-toolbar">
      <div class="toolbar-group">
        <span class="toolbar-label">Absolute Canvas Translation</span>
        <div class="btn-group" id="rope-shift-group">
          <button type="button" class="fig-btn active" data-shift="0">Baseline (0, 0)</button>
          <button type="button" class="fig-btn" data-shift="10">+10 Offset</button>
          <button type="button" class="fig-btn" data-shift="50">+50 Offset</button>
        </div>
      </div>
      <div class="toolbar-group">
        <span class="toolbar-label">Relative Displacement Δx</span>
        <input type="range" class="fig-slider" id="rope-dx-slider" min="1" max="5" value="2" step="1">
      </div>
    </div>
  </div>
  <figcaption class="fig-caption">Fig 2.1: In 2D-RoPE, rotating query and key vectors in complex planes cancels absolute coordinates out completely, making attention strictly dependent on relative offset Δp.</figcaption>
</figure>

This cancellation is what gives 2D-RoPE its translation invariance. Why can we not simply flatten the 2D grid into a 1D sequence and use standard language-model 1D RoPE? In a 2D image of width $W$, vertically adjacent patches at $(x, y)$ and $(x, y+1)$ end up separated by $W/P$ steps in sequence order. Standard 1D RoPE measures scalar distance along the token index, so it views vertically neighboring patches as distant tokens, destroying 2D spatial locality. 2D-RoPE decomposes each head's channels into independent $x$ and $y$ rotational sub-planes. Because complex multiplication subtracts angles, the attention logit between two patches depends purely on their 2D displacement vector $\Delta \mathbf{p} = (u_x - v_x, u_y - v_y)$, preserving true Euclidean geometry regardless of aspect ratio or resolution.

## 3. Google's NaViT: Patch 'n' Pack and arbitrary aspect ratios

Standard vision models process square inputs ($224 \times 224$ or $384 \times 384$) because hardware matrix multipliers expect rectangular tensors. Non-square inputs either get resized, which distorts object aspect ratios, or padded with zeros, which wastes attention operations on empty space. For panoramic ($16:9$) or portrait ($9:16$) images, up to 40% of tokens in a batch can be padding tokens.

Google Research designed NaViT (Native Resolution ViT) around an approach called Patch 'n' Pack, borrowing sequence packing from NLP.

<div class="svg-diagram">
<svg viewBox="0 0 740 210" class="diagram-svg" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="25" width="310" height="165" rx="8" fill="#0c0a15" stroke="#f43f5e" stroke-width="1.5"/>
  <text x="175" y="50" fill="#f43f5e" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">STANDARD ViT (PADDING WASTE)</text>
  <rect x="40" y="65" width="60" height="40" rx="4" fill="#1a1a24" stroke="#06b6d4" stroke-width="1.5"/>
  <text x="70" y="90" fill="#06b6d4" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Img 1</text>
  <rect x="110" y="65" width="70" height="70" rx="4" fill="#0c0a15" stroke="#88888e" stroke-dasharray="3 3"/>
  <text x="145" y="105" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="9" text-anchor="middle">Pad (0s)</text>
  <text x="175" y="165" fill="#f43f5e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Up to 40% wasted attention FLOPs</text>

  <rect x="370" y="25" width="350" height="165" rx="8" fill="#0c0a15" stroke="#10b981" stroke-width="1.5"/>
  <text x="545" y="50" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">GOOGLE NaViT (PATCH 'N' PACK)</text>
  <rect x="390" y="70" width="80" height="35" rx="4" fill="#1a1a24" stroke="#06b6d4" stroke-width="1.5"/>
  <text x="430" y="92" fill="#06b6d4" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Img 1 (n₁)</text>
  <rect x="480" y="70" width="110" height="35" rx="4" fill="#1a1a24" stroke="#fbbf24" stroke-width="1.5"/>
  <text x="535" y="92" fill="#fbbf24" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Img 2 (n₂)</text>
  <rect x="600" y="70" width="100" height="35" rx="4" fill="#1a1a24" stroke="#10b981" stroke-width="1.5"/>
  <text x="650" y="92" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Img 3 (n₃)</text>
  <text x="545" y="135" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="11" text-anchor="middle">Continuous Buffer: Length L = Σ n_k</text>
  <text x="545" y="165" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Block-diagonal attention mask: 0% padding</text>
</svg>
</div>

### The Patch 'n' Pack formulation

Instead of allocating one image per batch index, multiple images $I_1, I_2, \dots, I_K$ with patch counts $n_1, n_2, \dots, n_K$ are packed into a single sequence buffer of length $L$:

$$\sum_{k=1}^K n_k \le L$$

Each patch token receives continuous 2D coordinates $(x_i, y_i) \in [0, 1]^2$, normalized to the original image dimensions:

$$x_i = \frac{c_i \cdot P}{W_{\text{orig}}}, \quad y_i = \frac{r_i \cdot P}{H_{\text{orig}}}$$

To prevent tokens from different images attending to each other within the shared sequence, the attention matrix applies an indicator mask:

$$\mathbf{A}_{i, j} = \begin{cases} \frac{\mathbf{q}_i^\top \mathbf{k}_j}{\sqrt{d_k}} & \text{if } \text{img\_id}(i) = \text{img\_id}(j) \\ -\infty & \text{if } \text{img\_id}(i) \neq \text{img\_id}(j) \end{cases}$$

This structure produces a block-diagonal attention map. Because self-attention is permutation-equivariant up to position encodings, the network processes different images and aspect ratios concurrently in a single forward pass without padding overhead.

### Stepping through the numbers: the block-diagonal packing mask

Suppose we pack two images into a shared buffer of length $L=5$:

* Image 1 is rectangular, producing $n_1 = 2$ patches (tokens $t_1, t_2$).
* Image 2 is square, producing $n_2 = 3$ patches (tokens $t_3, t_4, t_5$).

The unmasked self-attention logits form a $(5 \times 5)$ affinity matrix $\mathbf{S}$.

Applying the NaViT indicator mask produces the block-diagonal structure:

$$\mathbf{A} = \begin{pmatrix}
s_{11} & s_{12} & -\infty & -\infty & -\infty \\
s_{21} & s_{22} & -\infty & -\infty & -\infty \\
-\infty & -\infty & s_{33} & s_{34} & s_{35} \\
-\infty & -\infty & s_{43} & s_{44} & s_{45} \\
-\infty & -\infty & s_{53} & s_{54} & s_{55}
\end{pmatrix}$$

When computing softmax along row 1:
$$\text{softmax}([s_{11}, s_{12}, -\infty, -\infty, -\infty]) = [p_{11}, p_{12}, 0, 0, 0]$$
Because $e^{-\infty} = 0$, attention weights for tokens from Image 2 evaluate to zero. Both images process inside the exact same matrix multiplication with zero padding tokens.

This packing mechanism directly eliminates GPU idle bubbles during pre-training. Standard vision architectures force every image into a uniform batch shape, which either distorts rectangular frames into squashed squares or wastes up to 40% of the training compute budget calculating attention over useless zero-padding tokens. By packing patch tokens from variable-sized images into continuous fixed-length sequence buffers using first-fit bin packing, NaViT ensures that GPU tensor cores operate at maximum saturation. With FlashAttention-style variable-length masking, the $-\infty$ mask ensures that attention never leaks across image boundaries, giving the network full multi-aspect native resolution with zero padding overhead.

## 4. Self-supervised distillation: DINO and DINOv2

Supervised training optimizes for discrete class labels, which discards fine spatial details. Self-supervised distillation learns dense visual representations directly from data without human annotation. DINO and DINOv2 use student-teacher distillation with explicit mechanisms to prevent representation collapse.

<div class="svg-diagram">
<svg viewBox="0 0 740 220" class="diagram-svg" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="70" width="120" height="75" rx="8" fill="#0c0a15" stroke="#06b6d4" stroke-width="2"/>
  <text x="80" y="105" fill="#06b6d4" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">IMAGE x</text>
  <text x="80" y="125" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Global/Local</text>
  <path d="M 145 95 L 205 60" stroke="#10b981" stroke-width="1.5"/>
  <path d="M 145 120 L 205 155" stroke="#fbbf24" stroke-width="1.5"/>
  <rect x="210" y="25" width="165" height="70" rx="8" fill="#0c0a15" stroke="#10b981" stroke-width="1.5"/>
  <text x="292" y="55" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="bold" text-anchor="middle">STUDENT g_θs</text>
  <text x="292" y="75" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Temp τ_s = 0.1</text>
  <rect x="210" y="125" width="165" height="70" rx="8" fill="#0c0a15" stroke="#fbbf24" stroke-width="1.5"/>
  <text x="292" y="155" fill="#fbbf24" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="bold" text-anchor="middle">TEACHER g_θt (EMA)</text>
  <text x="292" y="175" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Center c + Sharpen τ_t = 0.04</text>
  <path d="M 380 60 L 465 95" stroke="#10b981" stroke-width="1.5"/>
  <path d="M 380 160 L 465 125" stroke="#fbbf24" stroke-width="1.5"/>
  <rect x="470" y="70" width="240" height="75" rx="8" fill="#0c0a15" stroke="#f43f5e" stroke-width="2"/>
  <text x="590" y="102" fill="#f43f5e" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">CROSS-ENTROPY LOSS</text>
  <text x="590" y="125" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="11" text-anchor="middle">L = - Σ P_t(x) log P_s(x)</text>
</svg>
</div>

### Student-teacher distillation

DINO feeds different augmented views of an image to two networks:

* Student network $g_{\theta_s}$: processes global and local crops, parameterized by weights $\theta_s$.
* Teacher network $g_{\theta_t}$: processes global crops only, parameterized by weights $\theta_t$.

The intuition of multi-crop distillation is local-to-global matching: the student sees only a small crop (for example, a bird's beak) and must predict the distribution produced by the teacher looking at the full image (the whole bird).

Teacher weights do not receive gradients. They update using an Exponential Moving Average (EMA) of the student weights:

$$\theta_t \leftarrow \lambda \theta_t + (1 - \lambda) \theta_s, \quad \lambda \in [0.996, 1.0]$$

Each network projects features into a $K$-dimensional probability distribution using temperature-scaled softmax:

$$P_s(x)^{(k)} = \frac{\exp\left( g_{\theta_s}(x)^{(k)} / \tau_s \right)}{\sum_{j=1}^K \exp\left( g_{\theta_s}(x)^{(j)} / \tau_s \right)}$$

$$P_t(x)^{(k)} = \frac{\exp\left( (g_{\theta_t}(x)^{(k)} - c^{(k)}) / \tau_t \right)}{\sum_{j=1}^K \exp\left( (g_{\theta_t}(x)^{(j)} - c^{(j)}) / \tau_t \right)}$$

Here $\tau_s$ and $\tau_t$ are temperature parameters, and $\mathbf{c} \in \mathbb{R}^K$ is a dynamic centering vector.

The objective minimizes cross-entropy between the student prediction and the teacher distribution:

$$\mathcal{L}_{\text{DINO}} = - \sum_{k=1}^K P_t(x)^{(k)} \log P_s(x)^{(k)}$$

### Centering and sharpening mechanics

Without negative pairs, self-distillation can collapse in two ways:

1. Uniform collapse: the distribution becomes completely flat across all outputs, maximizing entropy.
2. One-hot collapse: the model outputs 100% probability on a single dimension regardless of input, minimizing entropy.

DINO balances these tendencies with centering and sharpening:

Subtracting the running mean $\mathbf{c}$ prevents any single coordinate from dominating:

$$\mathbf{c} \leftarrow m \mathbf{c} + (1 - m) \frac{1}{B} \sum_{i=1}^B g_{\theta_t}(x_i)$$

The mathematical intuition: if dimension $k$ activates frequently across a batch, $c^{(k)}$ increases, subtracting value from that logit in subsequent iterations. This acts like a repulsive negative feedback loop.

Setting $\tau_t < \tau_s$ (for example, $\tau_t = 0.04$ and $\tau_s = 0.1$) sharpens the teacher output distribution, preventing the logits from decaying toward a uniform vector.

### DINOv2: patch-level MIM and the KoLeo regularizer

DINOv2 extends DINOv1 in two major mathematical directions:

#### 1. Patch-level Masked Image Modeling (iBOT)

In addition to the global class token distillation loss, DINOv2 masks a random subset of patches in the student input with mask token $\mathbf{e}_{\text{mask}}$, and computes cross-entropy over patch representations against the unmasked teacher output:

$$\mathcal{L}_{\text{patch}} = - \sum_{i \in \text{Masked}} \sum_{k=1}^K P_t(\mathbf{x}_i)^{(k)} \log P_s(\mathbf{x}_i)^{(k)}$$

This forces individual patch embeddings to encode localized visual semantics rather than relying entirely on the global class token.

#### 2. The KoLeo regularizer

Even with centering and sharpening, high-dimensional representations can collapse into a low-dimensional subspace (for example, lying on a flat line or plane on the unit hypersphere). DINOv2 uses the Kozachenko-Leonenko (KoLeo) differential entropy estimator to spread representations uniformly across the sphere.

For normalized feature vectors $\{\mathbf{z}_1, \dots, \mathbf{z}_n\}$, the KoLeo loss maximizes the Euclidean distance between each vector and its nearest distinct neighbor:

$$\mathcal{L}_{\text{KoLeo}} = - \frac{1}{n} \sum_{i=1}^n \log \left( \min_{j \neq i} \| \mathbf{z}_i - \mathbf{z}_j \|_2 \right)$$

The gradient with respect to sample $\mathbf{z}_i$ and its nearest neighbor $\mathbf{z}_{n(i)}$ is:

$$\frac{\partial \mathcal{L}_{\text{KoLeo}}}{\partial \mathbf{z}_i} = - \frac{1}{n} \frac{\mathbf{z}_i - \mathbf{z}_{n(i)}}{\| \mathbf{z}_i - \mathbf{z}_{n(i)} \|_2^2}$$

The intuition: as two vectors draw closer together, $\| \mathbf{z}_i - \mathbf{z}_{n(i)} \|_2 \to 0$, the gradient magnitude increases inversely with squared distance. Like electrostatic repulsion between electrons on a sphere, the vectors push apart until they tile the unit hypersphere $\mathbb{S}^{D-1}$ uniformly.

### Stepping through the numbers: centering, sharpening, and repulsion in action

Take an embedding space of dimension $K=3$.

Suppose raw teacher logits for an image are:
$$\mathbf{g}_t = [4.0, \ 1.0, \ 1.0]$$
The running mean center vector is currently:
$$\mathbf{c} = [2.0, \ 0.5, \ 0.5]$$

Step 1: Centering
Subtract $\mathbf{c}$ from $\mathbf{g}_t$:
$$\mathbf{g}_t - \mathbf{c} = [4.0 - 2.0, \ 1.0 - 0.5, \ 1.0 - 0.5] = [2.0, \ 0.5, \ 0.5]$$
The first dimension fired strongly, so $c_1=2.0$ subtracted more from it than from the other dimensions.

Step 2: Sharpening with temperature
Apply teacher temperature $\tau_t = 0.5$:
$$\frac{\mathbf{g}_t - \mathbf{c}}{\tau_t} = [4.0, \ 1.0, \ 1.0]$$
Exponentiating gives $[e^4, e^1, e^1] \approx [54.6, 2.7, 2.7]$.
The teacher probability distribution is:
$$P_t = [0.91, \ 0.045, \ 0.045]$$
If we had used the student temperature $\tau_s = 1.0$ without sharpening, the distribution would be $[0.67, 0.16, 0.16]$. The low temperature sharpened the target into a confident prediction.

Step 3: KoLeo repulsive gradient
Take two 2D unit vectors on a circle:
$$\mathbf{z}_1 = [1.0, \ 0.0], \quad \mathbf{z}_2 = [0.96, \ 0.28]$$
The difference vector is:
$$\mathbf{z}_1 - \mathbf{z}_2 = [0.04, \ -0.28]$$
The squared distance is:
$$\|\mathbf{z}_1 - \mathbf{z}_2\|_2^2 = 0.04^2 + (-0.28)^2 = 0.0016 + 0.0784 = 0.08$$
The repulsive gradient on $\mathbf{z}_1$ evaluates to:
$$\frac{\partial \mathcal{L}}{\partial \mathbf{z}_1} \propto - \frac{[0.04, \ -0.28]}{0.08} = [-0.5, \ 3.5]$$
The gradient pushes $\mathbf{z}_1$ in direction $[-0.5, 3.5]$, repelling it directly away from $\mathbf{z}_2$.

<figure class="interactive-fig" id="fig-dino-explorer">
  <div class="fig-card">
    <div class="fig-header">
      <span class="fig-title">DINO Distillation: Centering, Sharpening & Collapse Dynamics</span>
      <span class="fig-status" id="dino-stats-badge">Centering: ON · τ_t = 0.04 (Target Sharpened)</span>
    </div>
    <svg id="dino-svg" viewBox="0 0 680 230" class="fig-svg" xmlns="http://www.w3.org/2000/svg">
      <!-- Rendered dynamically by script -->
    </svg>
    <div class="fig-toolbar">
      <div class="toolbar-group">
        <span class="toolbar-label">Centering Negative Feedback</span>
        <div class="btn-group" id="dino-center-group">
          <button type="button" class="fig-btn active" id="dino-btn-on">Centering ON</button>
          <button type="button" class="fig-btn" id="dino-btn-off">Centering OFF (Collapse)</button>
        </div>
      </div>
      <div class="toolbar-group">
        <span class="toolbar-label">Teacher Temp (τ_t)</span>
        <input type="range" class="fig-slider" id="dino-temp-slider" min="0.02" max="0.30" value="0.04" step="0.02">
      </div>
    </div>
  </div>
  <figcaption class="fig-caption">Fig 4.1: Subtracting running center vector c prevents mode collapse to a single dominant class, while low teacher temperature sharpens the target probabilities.</figcaption>
</figure>

This balance between centering and sharpening solves the fundamental failure modes of self-supervised learning without contrastive pairs. Without negative samples to push divergent views apart, the student and teacher naturally collapse into one of two dead ends: uniform collapse, where all logits decay into flat zero entropy, or one-hot collapse, where a single arbitrary dimension fires strongly once and enters a self-reinforcing loop until every image in the universe outputs the exact same class index.
Centering acts as an automatic brake on logit monopolization. By tracking the running average $\mathbf{c}$ and subtracting it from teacher activations, any logit that fires too frequently gets penalized in subsequent iterations. Meanwhile, sharpening ($\tau_t < \tau_s$) acts as an accelerator, cooling the softmax distribution into sharp, confident probability targets. When DINOv2 adds the KoLeo regularizer, it enforces an explicit electrostatic repulsive gradient proportional to $1 / d^2$ between nearest neighbors, ensuring that feature vectors spread out and tile the unit hypersphere uniformly rather than collapsing into low-dimensional subspaces.

## 5. Meta's Segment Anything Model (SAM)

Meta AI introduced SAM to solve promptable visual segmentation. Unlike traditional segmentation models that predict fixed semantic categories, SAM evaluates arbitrary prompt conditions: points, bounding boxes, or rough mask sketches.

<div class="svg-diagram">
<svg viewBox="0 0 740 220" class="diagram-svg" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="30" width="150" height="155" rx="8" fill="#0c0a15" stroke="#10b981" stroke-width="1.5"/>
  <text x="95" y="65" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">IMAGE ENCODER</text>
  <text x="95" y="85" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">ViT (MAE pre-trained)</text>
  <text x="95" y="105" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">1024x1024 -> 64x64x256</text>
  <text x="95" y="145" fill="#06b6d4" font-family="'IBM Plex Mono', monospace" font-size="9.5" text-anchor="middle">Run once per image</text>

  <rect x="200" y="30" width="165" height="155" rx="8" fill="#0c0a15" stroke="#fbbf24" stroke-width="1.5"/>
  <text x="282" y="65" fill="#fbbf24" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">PROMPT ENCODER</text>
  <text x="282" y="90" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Points / Boxes / Masks</text>
  <text x="282" y="115" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="9.5" text-anchor="middle">Fourier Positional Feat</text>
  <text x="282" y="145" fill="#fbbf24" font-family="'IBM Plex Mono', monospace" font-size="9.5" text-anchor="middle">Run in &lt;10ms</text>

  <rect x="395" y="30" width="325" height="155" rx="8" fill="#0c0a15" stroke="#f43f5e" stroke-width="1.5"/>
  <text x="557" y="65" fill="#f43f5e" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">TWO-WAY MASK DECODER</text>
  <text x="557" y="90" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Tokens ↔ Image Features cross-attention</text>
  <text x="557" y="115" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="9.5" text-anchor="middle">MLP -> dynamic classifier weights w_mask</text>
  <text x="557" y="145" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="10" font-weight="bold" text-anchor="middle">Output: 3 Mask Hypotheses + IoU Score</text>
</svg>
</div>

### Image encoder architecture

SAM processes an input image of size $1024 \times 1024$ through a standard Vision Transformer backbone pre-trained with Masked Autoencoders (MAE). To handle the computational weight of $64 \times 64 = 4096$ patch tokens, SAM alternates between windowed local self-attention (within $14 \times 14$ patch grids) and 4 global attention blocks distributed evenly through the network.

The output image embedding is a spatial tensor:

$$\mathbf{F} \in \mathbb{R}^{64 \times 64 \times 256}$$

### Prompt encoder: Fourier positional embeddings

Prompts fall into two categories:

1. Sparse prompts (points and bounding boxes): a point coordinate $\mathbf{v} = (x, y)$ in $[0, 1]^2$ maps to a 256-dimensional vector using random Fourier feature positional encodings:

$$\gamma(\mathbf{v}) = \left[ \sin(2\pi \mathbf{B}\mathbf{v}), \ \cos(2\pi \mathbf{B}\mathbf{v}) \right]^\top$$

where $\mathbf{B} \in \mathbb{R}^{128 \times 2}$ is a static projection matrix with entries drawn from a Gaussian distribution $\mathcal{N}(0, \sigma^2)$.

The mathematical intuition behind Fourier features: neural networks exhibit spectral bias, learning low-frequency functions easily while struggling with high-frequency spatial transitions. Mapping raw $(x, y)$ coordinates into high-frequency sinusoids allows the transformer to distinguish adjacent pixel coordinates precisely.

To distinguish positive foreground points from negative background points and bounding box corners, a learned prompt type embedding $\mathbf{e}_{\text{type}} \in \mathbb{R}^{256}$ is added to the Fourier vector:

$$\mathbf{p}_{\text{sparse}} = \gamma(\mathbf{v}) + \mathbf{e}_{\text{type}}$$

2. Dense prompts (input masks): an initial binary mask $\mathbf{M} \in \{0, 1\}^{1024 \times 1024}$ passes through four consecutive convolutional layers with $2\times$ downsampling and GELU activations, matching the $(64 \times 64 \times 256)$ spatial dimension of $\mathbf{F}$.

### Two-way transformer mask decoder

The decoder runs two cross-attention layers that update prompt tokens and image tokens symmetrically:

1. Prompt-to-image cross-attention: prompt tokens attend to image patch embeddings $\mathbf{F}$.
2. Image-to-prompt cross-attention: image patch embeddings $\mathbf{F}$ attend back to the updated prompt tokens.

After the two-way attention layers, the updated output token passes through a 3-layer MLP that outputs dynamic classification weights $\mathbf{w}_{\text{mask}} \in \mathbb{R}^{32}$.

Concurrently, the image feature map $\mathbf{F}$ is upscaled by $4\times$ via transposed convolutions to dimension $256 \times 256 \times 32$. The final mask logits evaluate as a spatial inner product:

$$\text{Logits}(x, y) = \mathbf{w}_{\text{mask}}^\top \mathbf{F}_{\text{upscaled}}(x, y)$$

### Loss formulation: Focal Loss and Dice Loss

SAM trains on its dynamic segmentation predictions using a weighted combination of Focal Loss and Dice Loss:

$$\mathcal{L}_{\text{SAM}} = 20 \cdot \mathcal{L}_{\text{focal}} + \mathcal{L}_{\text{dice}}$$

Focal loss compensates for the extreme imbalance between background pixels and small target masks:

$$\mathcal{L}_{\text{focal}} = - \frac{1}{HW} \sum_{i=1}^{HW} \alpha_t (1 - p_{t, i})^\gamma \log(p_{t, i})$$

where $p_{t, i} = \sigma(\text{logit}_i)$ if ground truth $y_i = 1$, and $1 - \sigma(\text{logit}_i)$ otherwise, with focusing parameter $\gamma = 2$. The term $(1 - p_{t, i})^\gamma$ drives loss to near zero on well-classified background pixels, focusing gradients on uncertain boundary pixels.

Dice loss directly optimizes the soft Intersection-over-Union (IoU) between predicted probability map $\mathbf{P}$ and binary ground truth $\mathbf{Y}$:

$$\mathcal{L}_{\text{dice}} = 1 - \frac{2 \sum_{i=1}^{HW} y_i p_i + \epsilon}{\sum_{i=1}^{HW} y_i + \sum_{i=1}^{HW} p_i + \epsilon}$$

To resolve geometric ambiguity (for example, a single point click could refer to a person's shirt, the person, or the entire scene), SAM predicts 3 candidate masks (subpart, part, whole) along with an estimated IoU score trained with Mean Squared Error (MSE) against the real mask IoU.

### Stepping through the numbers: how a prompt carves out a mask

Let the upscaled image features at coordinate $(x, y)$ be a 4-dimensional vector:
$$\mathbf{f}_{(x, y)} = [1.2, \ -0.5, \ 2.0, \ 0.1]$$

After two-way cross-attention, the mask token outputs dynamic classifier weights:
$$\mathbf{w}_{\text{mask}} = [1.0, \ 0.0, \ 1.5, \ -1.0]$$

Compute the mask logit at this pixel:
$$\text{logit} = \mathbf{w}_{\text{mask}}^\top \mathbf{f} = (1.0)(1.2) + (0.0)(-0.5) + (1.5)(2.0) + (-1.0)(0.1)$$
$$\text{logit} = 1.2 + 0.0 + 3.0 - 0.1 = 4.1$$

Pass through sigmoid to get pixel foreground probability:
$$p = \sigma(4.1) = \frac{1}{1 + e^{-4.1}} \approx \frac{1}{1 + 0.0166} \approx 0.984$$
Because $p > 0.5$, coordinate $(x, y)$ is classified as inside the mask.

Now compute Focal Loss on this pixel if true label $y = 1$:
$$p_t = 0.984$$
$$\mathcal{L}_{\text{focal}} = - (1 - 0.984)^2 \log(0.984) = - (0.016)^2 (-0.0161) \approx (0.000256)(0.0161) \approx 0.0000041$$
Because the prediction was confident and correct, the focal loss term $(1 - p_t)^2 = 0.000256$ shrunk the gradient by nearly 4000 times.

This dynamic dot-product architecture is the secret behind SAM's real-time interactive speed. How can a model with a massive 632M parameter ViT-H backbone segment objects in under 50 milliseconds directly in a web browser?
The computational workload is strictly decoupled. The expensive ViT-H encoder processes the high-resolution $1024 \times 1024$ image exactly once on the backend, generating a downsampled $64 \times 64 \times 256$ spatial feature tensor that is cached in client or server RAM.
When a user interactively clicks a point, moves their cursor, or drags a bounding box, only the tiny prompt encoder and lightweight mask decoder run. Because the mask decoder contains fewer than 4 million parameters and only performs two transformer layers followed by the dynamic dot product, it finishes in milliseconds even on a laptop CPU or browser WebGPU runtime, giving users instantaneous, fluid mask feedback.

## 6. Contrastive foundations: classic CLIP vs Google SigLIP

Contrastive pre-training maps image and text representations into a shared vector space.

<div class="svg-diagram">
<svg viewBox="0 0 740 210" class="diagram-svg" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="25" width="330" height="165" rx="8" fill="#0c0a15" stroke="#f43f5e" stroke-width="1.5"/>
  <text x="185" y="50" fill="#f43f5e" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">CLASSIC CLIP (SOFTMAX)</text>
  <text x="185" y="80" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="11" text-anchor="middle">Denominator: Σ_j exp(t · x_i^T y_j)</text>
  <text x="185" y="105" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Requires AllGather across all GPUs</text>
  <text x="185" y="125" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">O(B²) memory bottleneck</text>
  <text x="185" y="160" fill="#f43f5e" font-family="'IBM Plex Mono', monospace" font-size="10" font-weight="bold" text-anchor="middle">Caps batch size around 32k - 65k</text>

  <rect x="390" y="25" width="330" height="165" rx="8" fill="#0c0a15" stroke="#10b981" stroke-width="1.5"/>
  <text x="555" y="50" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="bold" text-anchor="middle">GOOGLE SigLIP (PAIRWISE SIGMOID)</text>
  <text x="555" y="80" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="11" text-anchor="middle">Loss: - log σ(z_ij · (t · x_i^T y_j + b))</text>
  <text x="555" y="105" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Zero cross-GPU AllGather synchronization</text>
  <text x="555" y="125" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Tiled streaming O(B_local · B_chunk)</text>
  <text x="555" y="160" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="10" font-weight="bold" text-anchor="middle">Scales past 1,000,000+ batches</text>
</svg>
</div>

### Classic CLIP and InfoNCE loss

For normalized image representations $\mathbf{X} \in \mathbb{R}^{B \times D}$ and text representations $\mathbf{Y} \in \mathbb{R}^{B \times D}$ with similarity $S_{i, j} = \mathbf{x}_i^\top \mathbf{y}_j$ and temperature $t = \exp(\tau)$:

The InfoNCE loss treats diagonal pairs $(i, i)$ as positives and off-diagonal pairs $(i, j)$ ($j \neq i$) as negatives:

$$\mathcal{L}_{\text{image}\to\text{text}} = - \frac{1}{B} \sum_{i=1}^{B} \log \frac{\exp(t \cdot \mathbf{x}_i^\top \mathbf{y}_i)}{\sum_{j=1}^B \exp(t \cdot \mathbf{x}_i^\top \mathbf{y}_j)}$$

$$\mathcal{L}_{\text{text}\to\text{image}} = - \frac{1}{B} \sum_{i=1}^{B} \log \frac{\exp(t \cdot \mathbf{y}_i^\top \mathbf{x}_i)}{\sum_{j=1}^B \exp(t \cdot \mathbf{y}_j^\top \mathbf{x}_i)}$$

$$\mathcal{L}_{\text{CLIP}} = \frac{1}{2} \left( \mathcal{L}_{\text{image}\to\text{text}} + \mathcal{L}_{\text{text}\to\text{image}} \right)$$

The denominator $\sum_{j=1}^B \exp(t \cdot \mathbf{x}_i^\top \mathbf{y}_j)$ introduces a global normalizer over all $B$ items. In distributed training:

* All GPU ranks must collect text embeddings from every other rank via an `AllGather` collective before evaluating the denominator.
* Two identical concepts in the same batch act as false negatives, penalizing valid representations.
* Computing the full $(B \times B)$ matrix requires $O(B^2)$ memory on a single rank, which caps practical batch sizes around 32,768 to 65,536 items.

### Google SigLIP: pairwise sigmoid loss

In 2023, Google DeepMind (Zhai et al.) replaced the softmax normalizer with independent binary logistic regressions for each pair in the batch.

Each cell $(i, j)$ in the similarity matrix is treated as a separate binary classification problem:

* $z_{i, j} = 1$ when $i = j$ (matching pair)
* $z_{i, j} = -1$ when $i \neq j$ (non-matching pair)

The SigLIP loss function is:

$$\mathcal{L}_{\text{SigLIP}} = - \frac{1}{|B|} \sum_{i=1}^{|B|} \sum_{j=1}^{|B|} \log \sigma \left( z_{i, j} \cdot (t \cdot \mathbf{x}_i^\top \mathbf{y}_j + b) \right)$$

Here $\sigma(z) = \frac{1}{1 + e^{-z}}$, $t$ is a learnable temperature, and $b$ is a learnable scalar bias.

Writing out positive and negative terms explicitly:

$$\mathcal{L}_{\text{SigLIP}} = - \frac{1}{|B|} \sum_{i=1}^{|B|} \left[ \log \sigma(t \cdot \mathbf{x}_i^\top \mathbf{y}_i + b) + \sum_{j \neq i} \log \sigma(- (t \cdot \mathbf{x}_i^\top \mathbf{y}_j + b)) \right]$$

Applying $\log \sigma(-u) = -u - \log(1 + e^{-u})$ yields:

$$\mathcal{L}_{\text{SigLIP}} = \frac{1}{|B|} \sum_{i=1}^{|B|} \left[ \log(1 + e^{-(t \mathbf{x}_i^\top \mathbf{y}_i + b)}) + \sum_{j \neq i} \log(1 + e^{t \mathbf{x}_i^\top \mathbf{y}_j + b}) \right]$$

### Computational properties of the sigmoid loss

1. No global partition function: because the loss sums independent pairwise terms, devices do not need to gather the entire batch before loss computation.
2. Chunked evaluation: similarity calculations can run block by block in memory, reducing the memory requirement from $O(B^2)$ to $O(B_{\text{local}} \cdot B_{\text{chunk}})$.
3. Batch scalability: without a competitive softmax denominator, batch sizes can scale past 1,000,000 samples without gradient instability.
4. Bias parameter $b$: negative pairs outnumber positive pairs by $B^2 - B$ to $B$. Without offset $b$, negative gradients dominate training. Initializing $b$ to approximately $-10$ sets the baseline prior probability $\sigma(b) \approx 0.000045$, matching the low proportion of positive pairs in large batches.

### Stepping through the numbers: why SigLIP breaks free of the batch wall

Consider a small batch of $B=2$ image-text pairs:
* Pair 1: Image 1 and Caption 1 (matching positive, cosine similarity $s_{11} = 0.8$).
* Pair 2: Image 2 and Caption 2 (matching positive, cosine similarity $s_{22} = 0.7$).
* Cross pairs: similarity $s_{12} = 0.2$ and $s_{21} = 0.1$.
Let temperature scale $t = 2.0$.

Calculation 1: InfoNCE Softmax
For Image 1:
* Positive exp: $e^{2.0 \times 0.8} = e^{1.6} \approx 4.953$
* Negative exp: $e^{2.0 \times 0.2} = e^{0.4} \approx 1.492$
* Softmax denominator: $4.953 + 1.492 = 6.445$
* Loss for image 1: $- \log\left(\frac{4.953}{6.445}\right) = - \log(0.768) \approx 0.264$
Notice that if Image 2 were located on another GPU, GPU 1 could not compute the denominator $6.445$ without receiving Image 2 text embeddings over the network.

Calculation 2: SigLIP Independent Sigmoids
Let temperature $t = 2.0$ and learned bias $b = -0.5$.
* Positive pair $(1, 1)$:
  $$\text{logit} = t \cdot s_{11} + b = 2(0.8) - 0.5 = 1.1$$
  $$\text{Loss}_{11} = - \log \sigma(1.1) = - \log(0.750) \approx 0.287$$
* Negative pair $(1, 2)$:
  $$\text{logit} = t \cdot s_{12} + b = 2(0.2) - 0.5 = -0.1$$
  $$\text{Target } z_{12} = -1 \implies \text{argument} = -(-0.1) = +0.1$$
  $$\text{Loss}_{12} = - \log \sigma(-0.1) = \log(1 + e^{-0.1}) = \log(1 + 0.904) = \log(1.904) \approx 0.644$$

Pair $(1, 1)$ and pair $(1, 2)$ evaluate completely independently. Neither calculation requires a global sum, allowing GPU 1 to stream through tiles of negative captions stored in local memory.

<figure class="interactive-fig" id="fig-siglip-explorer">
  <div class="fig-card">
    <div class="fig-header">
      <span class="fig-title">Distributed Batch Scaling: Softmax AllGather vs SigLIP Streaming</span>
      <span class="fig-status" id="siglip-stats-badge">Batch = 32,768 · CLIP = 2.1 GB · SigLIP = 0.5 MB</span>
    </div>
    <svg id="siglip-svg" viewBox="0 0 680 230" class="fig-svg" xmlns="http://www.w3.org/2000/svg">
      <!-- Rendered dynamically by script -->
    </svg>
    <div class="fig-toolbar">
      <div class="toolbar-group">
        <span class="toolbar-label">Global Batch Size (B)</span>
        <div class="btn-group" id="siglip-batch-group">
          <button type="button" class="fig-btn" data-batch="8192">8,192</button>
          <button type="button" class="fig-btn active" data-batch="32768">32,768</button>
          <button type="button" class="fig-btn" data-batch="131072">131,072</button>
          <button type="button" class="fig-btn" data-batch="524288">524,288</button>
        </div>
      </div>
      <div class="toolbar-group">
        <span class="toolbar-label">Continuous Batch Slider</span>
        <input type="range" class="fig-slider" id="siglip-batch-slider" min="1" max="6" value="4" step="1">
      </div>
    </div>
  </div>
  <figcaption class="fig-caption">Fig 6.1: Classic CLIP requires an AllGather collective across all GPUs to evaluate the global softmax denominator, causing an O(B²) barrier. SigLIP's pairwise sigmoid loss allows linear chunked streaming without inter-GPU communication.</figcaption>
</figure>

This independence is the architectural breakthrough that broke the batch size barrier. Classic CLIP's InfoNCE loss is bound by its global partition function: the denominator $\sum_{j=1}^B \exp(t \mathbf{x}_i^\top \mathbf{y}_j)$ sums over all samples in the entire global batch. When pre-training across a cluster of 512 or 1,024 GPUs, each worker GPU is physically blocked from computing its loss until it executes a synchronous `AllGather` collective, transmitting its local text embeddings to every other GPU and receiving thousands of remote vectors in return.
At batch sizes of 32,768 or 65,536, network interconnect bandwidth saturates, and storing the full cross-similarity matrix triggers an $O(B^2)$ memory explosion.
SigLIP completely removes the global denominator. Because every pair $(i, j)$ is formulated as an independent binary classification, each worker GPU can load its local image embeddings and stream through chunks of negative text embeddings in small local tiles. No worker ever needs to pause for a cluster-wide `AllGather`. This allows distributed vision-language pre-training to scale gracefully to batches of 1,000,000+ image-text pairs with constant local memory overhead.

## 7. How Vision-Language Models (VLMs) came about

Vision-Language Models did not appear all at once. They evolved across four distinct architectural stages as researchers resolved the interface between continuous visual patches and discrete autoregressive language tokens.

<div class="svg-diagram">
<svg viewBox="0 0 740 250" class="diagram-svg" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="20" width="160" height="210" rx="8" fill="#0c0a15" stroke="#f43f5e" stroke-width="1.5"/>
  <text x="100" y="45" fill="#f43f5e" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="bold" text-anchor="middle">STAGE 1: DUAL ENCODER</text>
  <text x="100" y="65" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">CLIP, ALIGN (2021)</text>
  <rect x="35" y="85" width="130" height="40" rx="4" fill="#1a1a24" stroke="#88888e" stroke-width="1"/>
  <text x="100" y="105" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Global Pool: 1D Vector</text>
  <text x="100" y="155" fill="#f43f5e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Zero spatial tokens survive</text>
  <text x="100" y="185" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="9.5" text-anchor="middle">Good for retrieval only</text>

  <rect x="200" y="20" width="160" height="210" rx="8" fill="#0c0a15" stroke="#fbbf24" stroke-width="1.5"/>
  <text x="280" y="45" fill="#fbbf24" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="bold" text-anchor="middle">STAGE 2: CROSS-ATTN</text>
  <text x="280" y="65" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Flamingo, PaLI (2022)</text>
  <rect x="215" y="85" width="130" height="40" rx="4" fill="#1a1a24" stroke="#88888e" stroke-width="1"/>
  <text x="280" y="105" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Perceiver Resampler</text>
  <text x="280" y="155" fill="#fbbf24" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Frozen LLM + Gated Cross-Attn</text>
  <text x="280" y="185" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="9.5" text-anchor="middle">Compresses N -> M tokens</text>

  <rect x="380" y="20" width="160" height="210" rx="8" fill="#0c0a15" stroke="#06b6d4" stroke-width="1.5"/>
  <text x="460" y="45" fill="#06b6d4" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="bold" text-anchor="middle">STAGE 3: TOKEN INJECTION</text>
  <text x="460" y="65" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">LLaVA (2023)</text>
  <rect x="395" y="85" width="130" height="40" rx="4" fill="#1a1a24" stroke="#88888e" stroke-width="1"/>
  <text x="460" y="105" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Linear / MLP Adapter</text>
  <text x="460" y="155" fill="#06b6d4" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Patches as pseudo-words</text>
  <text x="460" y="185" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="9.5" text-anchor="middle">Direct LLM causal attention</text>

  <rect x="560" y="20" width="160" height="210" rx="8" fill="#0c0a15" stroke="#10b981" stroke-width="1.5"/>
  <text x="640" y="45" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="bold" text-anchor="middle">STAGE 4: UNIFIED VLM</text>
  <text x="640" y="65" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">PaliGemma 2 (2024)</text>
  <rect x="575" y="85" width="130" height="40" rx="4" fill="#1a1a24" stroke="#88888e" stroke-width="1"/>
  <text x="640" y="105" fill="#f1f5f9" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">SigLIP + Gemma</text>
  <text x="640" y="155" fill="#10b981" font-family="'IBM Plex Mono', monospace" font-size="10" text-anchor="middle">Native Patch 'n' Pack</text>
  <text x="640" y="185" fill="#88888e" font-family="'IBM Plex Mono', monospace" font-size="9.5" text-anchor="middle">End-to-end autoregressive</text>
</svg>
</div>

### Stage 1: Dual encoders and global vector pooling (CLIP, ALIGN)

Early vision-language work trained two separate encoders (one for images, one for text) using contrastive loss. The visual encoder passed its patch representations through an attention pooling layer or took the `[CLS]` token, collapsing the entire 2D image into a single 1D vector $\mathbf{z}_v \in \mathbb{R}^D$.

While effective for classification and image retrieval, collapsing the spatial grid to a single vector destroyed coordinate information. The model could identify that an image contained an object, but could not describe spatial relations or generate free-form text about specific regions.

### Stage 2: Cross-attention conditioning and Perceiver Resamplers (Flamingo, PaLI)

DeepMind's Flamingo preserved individual patch tokens by keeping a pre-trained vision encoder and a pre-trained language model frozen.

To inject visual context into the language decoder without retraining the entire LLM, Flamingo introduced Gated Cross-Attention layers into the transformer blocks:

$$\mathbf{y} = \mathbf{x} + \tanh(\alpha) \cdot \text{CrossAttention}(\mathbf{Q} = \mathbf{x}, \ \mathbf{K} = \mathbf{H}_v, \ \mathbf{V} = \mathbf{H}_v)$$

where $\alpha$ is a learnable scalar initialized to 0, ensuring that at the start of training the language model behaves identically to its frozen state.

Because high-resolution images produce thousands of patch tokens, feeding raw visual sequences into cross-attention creates latency bottlenecks. Flamingo introduced the Perceiver Resampler: a set of $M$ learnable latent query vectors $\mathbf{Q}_{\text{learn}} \in \mathbb{R}^{M \times D_{\text{llm}}}$ ($M \ll N$, typically $M = 64$) queries the visual features $\mathbf{Z}_v \in \mathbb{R}^{N \times D_v}$ via cross-attention:

$$\mathbf{H}_v = \text{softmax}\left( \frac{(\mathbf{Q}_{\text{learn}} \mathbf{W}_Q)(\mathbf{Z}_v \mathbf{W}_K)^\top}{\sqrt{d}} \right) (\mathbf{Z}_v \mathbf{W}_V)$$

This compresses arbitrary image resolutions into a fixed budget of 64 visual tokens.

### Stage 3: Direct visual token injection (LLaVA)

LLaVA demonstrated that cross-attention layers were not required. Instead, visual tokens could be projected directly into the language model word embedding space and concatenated with the prompt text tokens.

Two projection choices emerged:

1. Linear projection:

$$\mathbf{H}_v = \mathbf{Z}_v \mathbf{W}_{\text{proj}} + \mathbf{b}_{\text{proj}}, \quad \mathbf{W}_{\text{proj}} \in \mathbb{R}^{D_v \times D_{\text{llm}}}$$

2. Two-layer Multi-Layer Perceptron (MLP):

$$\mathbf{H}_v = \text{GELU}(\mathbf{Z}_v \mathbf{W}_1 + \mathbf{b}_1) \mathbf{W}_2 + \mathbf{b}_2$$

The language model treats each projected vector $\mathbf{h}_i^v$ as if it were a word embedding in its dictionary. The model attends across both image tokens and text tokens using standard causal self-attention.

### Stage 4: Unified autoregressive foundations (PaliGemma, PaliGemma 2)

Google's PaliGemma and PaliGemma 2 removed the separation between pre-trained components. Instead of stitching together frozen models with an adapter, the entire architecture trains end-to-end:

* Vision backbone: SigLIP-So400M, providing dense semantic representations pre-trained with pairwise sigmoid loss.
* Resolution flexibility: NaViT Patch 'n' Pack handles arbitrary native aspect ratios without distortion or padding.
* Language model: Gemma and Gemma 2 autoregressive decoders.

The visual tokens $\mathbf{H}_v = \{\mathbf{h}_1^v, \dots, \mathbf{h}_N^v\}$ and text prompt tokens $\mathbf{H}_t = \{\mathbf{h}_1^t, \dots, \mathbf{h}_K^t\}$ are concatenated into a unified sequence:

$$\mathbf{S} = [\mathbf{h}_1^v, \dots, \mathbf{h}_N^v, \ \mathbf{h}_1^t, \dots, \mathbf{h}_K^t]$$

The entire system trains by minimizing standard next-token cross-entropy over target response tokens:

$$\mathcal{L}_{\text{VLM}}(\theta) = - \sum_{i=1}^{T} \log \left( \frac{\exp(\mathbf{w}_{y_i}^\top \mathbf{u}_i)}{\sum_{w \in \mathcal{V}} \exp(\mathbf{w}_w^\top \mathbf{u}_i)} \right)$$

where $\mathbf{u}_i$ is the language decoder hidden state at token position $i$, and $\mathcal{V}$ is the text vocabulary.

This transition from gated cross-attention to unified token sequences explains why the modern VLM ecosystem consolidated so rapidly around autoregressive decoders.
In early VLMs like Flamingo, incorporating vision required splicing custom gated cross-attention layers into every single transformer layer of the pre-trained language model. While this left the pre-trained weights frozen, it created an awkward hybrid architecture that broke standard high-throughput serving stacks, complicated KV cache management, and required customized kernel backends.
Direct sequence injection (pioneered by LLaVA and unified end-to-end in PaliGemma and PaliGemma 2) realized that vision patches do not need special attention pathways. Once a lightweight linear projector or two-layer MLP maps visual patch features into the LLM's text embedding dimension, they are simply tokens. Standard autoregressive causal decoders process them alongside text using standard causal attention. Existing production LLM serving frameworks (like vLLM, TensorRT-LLM, and SGLang) can execute high-throughput multimodal inference out of the box with zero architectural changes.

## 8. Architecture comparison

| Model | Positional Encoding | Objective Function | Scaling Advantage | Tradeoff |
| :--- | :--- | :--- | :--- | :--- |
| **Vanilla ViT** (Dosovitskiy et al.) | 1D learned embeddings | Softmax Cross-Entropy | Direct transformer transfer to image patches | Quadratic self-attention complexity $O(N^2)$ |
| **DINOv2** (Oquab et al.) | Patch + `[CLS]`, 2D interpolation | Distillation + iBOT patch MIM + KoLeo regularizer | Dense feature maps without manual labels | Dual network training with EMA synchronization |
| **SAM** (Meta AI) | 2D Fourier random features + learned type embeddings | $20 \times \text{Focal Loss} + \text{Dice Loss}$ | Prompt-driven real-time mask generation | Heavy $1024 \times 1024$ encoder requires windowed attention |
| **Classic CLIP** (Radford et al.) | 1D learned embeddings | Symmetric InfoNCE Loss | Unified multimodal vector space | $O(B^2)$ memory and `AllGather` communication bottlenecks |
| **SigLIP** (Google DeepMind) | 2D learned embeddings | Pairwise Sigmoid Loss | Decoupled normalizer, batch scaling past $1\text{M}$ | Requires tuning initial bias $b$ and temperature $t$ |
| **NaViT** (Google Research) | Continuous coordinates $(x, y) \in [0, 1]^2$ | Contrastive or Masked Autoencoding | Native aspect ratios without zero-padding | Requires sequence packing logic and masked attention |
| **PaliGemma 2** (Google) | SigLIP-So400M backbone | Autoregressive Next-Token Cross-Entropy | Stable spatial grounding with linear projection | Linear adapter restricts projection capacity |
