/** Level 0: the whole computer, the parts on the motherboard and what plugs into it. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [
    { id: 'main', label: 'CPU and memory', tone: 'primary' },
    { id: 'slots', label: 'PCIe slots', tone: 'violet' },
    { id: 'hub', label: 'Chipset side', tone: 'teal' },
    { id: 'io', label: 'I/O devices', tone: 'peach' },
  ],
  nodes: [
    { id: 'psu', label: 'Power supply', detail: 'wall AC → 12 V, 5 V, 3.3 V', parent: 'main', tone: 'warn', info: 'Turns 230 V or 120 V AC from the wall into the low DC voltages the parts use. Small converters on the board (VRMs) step 12 V down again to about 1 V for the CPU cores.' },
    { id: 'cpu', label: 'CPU', tag: 'processor', detail: '8 cores at 4–5 GHz', parent: 'main', tone: 'primary', info: 'Runs the programs: fetches instructions from memory and executes them. It also holds the memory controller and the fastest PCIe lanes, so RAM, the GPU and the SSD connect to it directly.' },
    { id: 'ram', label: 'RAM', detail: '2 × 16 GB DDR5 sticks', shape: 'store', parent: 'main', tone: 'primary', info: 'Working memory: the programs and data in use right now. Fast, but forgets everything when the power goes off.' },
    { id: 'gpu', label: 'GPU', tag: 'graphics card', detail: 'PCIe x16 · thousands of small cores', parent: 'slots', tone: 'violet', info: 'A second processor with its own memory, built for running the same small step on lots of data at once: pixels, or the matrix math of AI. See [What a GPU is](/learn/what-is-a-gpu/).' },
    { id: 'ssd', label: 'NVMe SSD', detail: 'PCIe x4 · 1 TB of flash', shape: 'store', parent: 'slots', tone: 'violet', info: 'Storage that keeps its data without power: the operating system, programs and files. About 1000 times slower than RAM, but 30 times cheaper per gigabyte.' },
    { id: 'pch', label: 'Chipset (PCH)', detail: 'USB, audio, network, firmware', parent: 'hub', tone: 'teal', info: 'Platform Controller Hub: one chip that gathers the slower connections (USB, SATA, audio, Ethernet, the firmware flash) and passes them to the CPU over one link.' },
    { id: 'kbd', label: 'Keyboard', parent: 'io', tone: 'peach' },
    { id: 'mouse', label: 'Mouse', parent: 'io', tone: 'peach', info: 'An optical sensor (a tiny camera) takes thousands of pictures of the desk per second and works out how far they moved. A microcontroller sends the movement and the button states over USB, like the keyboard.' },
    { id: 'mic', label: 'Microphone', parent: 'io', tone: 'peach' },
    { id: 'display', label: 'Display', parent: 'io', tone: 'peach', info: 'The GPU sends finished frames over HDMI or DisplayPort, 60 to 240 times a second. The display only shows them; it does no computing for the computer.' },
  ],
  edges: [
    { from: 'psu', to: 'cpu', label: 'power', style: 'dashed', tone: 'warn' },
    { from: 'cpu', to: 'ram', label: 'DDR5', arrow: 'both' },
    { from: 'cpu', to: 'gpu', arrow: 'both' },
    { from: 'cpu', to: 'ssd', arrow: 'both' },
    { from: 'cpu', to: 'pch', label: 'DMI link', arrow: 'both' },
    { from: 'kbd', to: 'pch', label: 'USB' },
    { from: 'mouse', to: 'pch', label: 'USB' },
    { from: 'mic', to: 'pch', label: 'audio' },
    { from: 'gpu', to: 'display', label: 'HDMI / DP' },
  ],
});
