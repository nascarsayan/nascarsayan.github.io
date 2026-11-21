/** Compile pipelines: CUDA to SASS via PTX; HIP to AMDGCN code objects. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'nv', label: 'NVIDIA: nvcc', tone: 'lime', direction: 'right' },
    { id: 'amd', label: 'AMD: hipcc', tone: 'peach', direction: 'right' },
  ],
  nodes: [
    { id: 'cu', label: 'k.cu (CUDA C++)', parent: 'nv' },
    { id: 'ptx', label: 'PTX', parent: 'nv', detail: 'virtual ISA, text', info: 'nvcc -ptx prints it. Targets a virtual architecture such as compute_90. Forward compatible: a newer driver can compile it for a newer GPU.' },
    { id: 'sass', label: 'SASS in a cubin', parent: 'nv', detail: 'per sm_XX', info: 'ptxas turns PTX into real machine code for one architecture (sm_90 for H100, sm_100 for B200). cuobjdump -sass shows it.' },
    { id: 'fat', label: '.nv_fatbin', parent: 'nv', shape: 'store', detail: 'cubins + PTX', info: 'Embedded in the host executable or .so. At load the driver picks a matching cubin, or JIT-compiles the PTX and caches it in ~/.nv/ComputeCache.' },
    { id: 'hip', label: 'k.hip (HIP C++)', parent: 'amd' },
    { id: 'ir', label: 'LLVM IR', parent: 'amd', detail: 'inside the compiler', info: 'Not shipped in normal builds. --save-temps keeps it as .bc files.' },
    { id: 'co', label: 'Code object (ELF)', parent: 'amd', detail: 'per gfx target', info: 'One AMDGCN ELF per --offload-arch, for example gfx950 for MI355X. llvm-objdump -d disassembles it.' },
    { id: 'bund', label: '.hip_fatbin', parent: 'amd', shape: 'store', detail: 'offload bundle', info: 'clang-offload-bundler packs one code object per target. At load the HIP runtime picks the one whose target ID matches the GPU. No match: hipErrorNoBinaryForGpu, "no kernel image is available for execution on the device".' },
  ],
  edges: [
    { from: 'cu', to: 'ptx', label: 'front end + NVVM' },
    { from: 'ptx', to: 'sass', label: 'ptxas' },
    { from: 'sass', to: 'fat', label: 'fatbinary' },
    { from: 'hip', to: 'ir', label: 'clang' },
    { from: 'ir', to: 'co', label: 'AMDGPU backend' },
    { from: 'co', to: 'bund', label: 'bundler' },
  ],
});
