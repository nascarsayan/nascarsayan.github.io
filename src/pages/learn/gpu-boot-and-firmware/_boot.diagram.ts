/** A GPU's life from power-on to a kernel running: firmware, driver probe, runtime, launch. AMD names. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'sequence',
  participants: [
    { id: 'bmc', label: 'BMC / BIOS', detail: 'BMC firmware, UEFI', tone: 'muted' },
    { id: 'psp', label: 'GPU firmware', detail: 'PSP, SMU', tone: 'warn' },
    { id: 'drv', label: 'amdgpu + KFD', detail: 'kernel driver', tone: 'primary' },
    { id: 'rt', label: 'ROCr / HIP', detail: 'in the container', tone: 'teal' },
    { id: 'cp', label: 'Command processor', detail: 'on the GPU', tone: 'pink' },
  ],
  messages: [
    { from: 'bmc', to: 'psp', label: 'power on; PSP boots from on-board flash (IFWI)' },
    { from: 'psp', to: 'psp', label: 'bring up HBM, start SMU (power, clocks)' },
    { from: 'bmc', to: 'drv', label: 'PCIe enumerates GPU; Linux loads amdgpu' },
    { from: 'drv', to: 'psp', label: 'IP discovery; hand firmware from /lib/firmware to PSP' },
    { from: 'psp', to: 'drv', label: 'verified and loaded: CP, SDMA, RLC microcode' },
    { from: 'drv', to: 'drv', label: 'RAS init, XGMI hive join, partition mode' },
    { from: 'drv', to: 'drv', label: 'create /dev/kfd and /dev/dri/renderD*' },
    { from: 'rt', to: 'drv', label: 'open /dev/kfd; allocate VRAM; create queue', tone: 'good' },
    { from: 'drv', to: 'rt', label: 'queue ring buffer + doorbell mapped', tone: 'good' },
    { from: 'rt', to: 'rt', label: 'write AQL dispatch packet into ring' },
    { from: 'rt', to: 'cp', label: 'ring doorbell (one memory write, no syscall)', tone: 'good' },
    { from: 'cp', to: 'cp', label: 'read packet; spread workgroups over CUs' },
    { from: 'cp', to: 'rt', label: 'completion signal written to memory' },
  ],
  frames: [
    { label: 'Boot (once per power cycle)', from: 'm1', to: 'm2', tone: 'warn' },
    { label: 'Driver load (once per modprobe)', from: 'm3', to: 'm7', tone: 'primary' },
    { label: 'Process setup', from: 'm8', to: 'm9', tone: 'teal' },
    { label: 'Every kernel launch', from: 'm10', to: 'm13', tone: 'pink' },
  ],
});
