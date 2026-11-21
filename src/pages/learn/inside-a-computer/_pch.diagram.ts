/** Level 1: the chipset (PCH). */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [
    { id: 'ports', label: 'Controllers', tone: 'teal' },
    { id: 'plat', label: 'Platform', tone: 'muted' },
  ],
  nodes: [
    { id: 'dmi', label: 'DMI link', detail: 'to the CPU, ~16 GB/s', band: -1, tone: 'sky' },
    { id: 'usb', label: 'USB controller', detail: 'xHCI: keyboard, mouse', parent: 'ports', tone: 'teal', info: 'The host controller polls each device on a schedule (every 1 ms or faster for a keyboard) and writes what it gets into RAM by DMA, then raises an interrupt.' },
    { id: 'hda', label: 'Audio link', detail: 'HD Audio to the codec chip', parent: 'ports', tone: 'teal' },
    { id: 'nic', label: 'Ethernet', detail: '2.5 Gbit/s', parent: 'ports', tone: 'teal' },
    { id: 'sata', label: 'SATA', detail: 'older disks', parent: 'ports', tone: 'teal' },
    { id: 'spi', label: 'Firmware flash', detail: 'UEFI, 32 MB via SPI', shape: 'store', parent: 'plat', tone: 'warn', info: 'The first code the CPU runs at power-on: it trains the memory, finds the devices, then loads the OS boot loader from the SSD.' },
    { id: 'tpm', label: 'TPM', detail: 'keys, measured boot', parent: 'plat' },
    { id: 'rtc', label: 'Real-time clock', detail: 'coin-cell battery', parent: 'plat' },
  ],
  edges: [
    { from: 'dmi', to: 'usb', arrow: 'both' },
    { from: 'dmi', to: 'hda', arrow: 'both' },
    { from: 'dmi', to: 'nic', arrow: 'both' },
    { from: 'dmi', to: 'spi', arrow: 'both' },
  ],
});
