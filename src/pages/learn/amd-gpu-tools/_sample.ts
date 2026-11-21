/**
 * Illustrative output for one example 8× MI355X node, GPU 4 (card5). The values
 * are made up but realistic; rows and columns are cut and spacing narrowed.
 * Every derived number on the page is computed here from these strings.
 */
export const host = 'gpu-node-1';

export const list = `GPU: 4
    BDF: 0000:8b:00.0
    UUID: 00000000-0000-0000-0000-000000000005
    KFD_ID: 45678
    NODE_ID: 6
    PARTITION_ID: 0
    RENDER: renderD132
    CARD: card5
    HSA_ID: 6
    HIP_ID: 4
    HIP_UUID: GPU-00000000-0000-0000-0000-000000000005
    OAM_ID: 6`;

export const staticOut = `GPU: 4
    ASIC:
        MARKET_NAME: AMD Instinct MI355X
        NUM_COMPUTE_UNITS: 256
        TARGET_GRAPHICS_VERSION: gfx950
    LIMIT:
        PPT0:
            SOCKET_POWER_LIMIT: 1400 W
        SLOWDOWN_EDGE_TEMPERATURE: N/A
        SLOWDOWN_HOTSPOT_TEMPERATURE: 100 °C
        SLOWDOWN_VRAM_TEMPERATURE: 105 °C
        SHUTDOWN_HOTSPOT_TEMPERATURE: 110 °C
        SHUTDOWN_VRAM_TEMPERATURE: 115 °C
    BOARD:
        MODEL_NUMBER: 102-EXAMPLE-00
        PRODUCT_SERIAL: SN-EXAMPLE-0005
        PRODUCT_NAME: AMD Instinct MI355X OAM
    RAS:
        BAD_PAGE_THRESHOLD: 128
        BAD_PAGE_THRESHOLD_EXCEEDED: False
        POISON_SCHEMA: ENABLED
    PARTITION:
        ACCELERATOR_PARTITION: SPX
        MEMORY_PARTITION: NPS1
    NUMA:
        NODE: 1
    VRAM:
        TYPE: HBM3E
        SIZE: 294912 MB
        MAX_BANDWIDTH: 8192 GB/s`;

export const monitor = `GPU  XCP  POWER  PWR_CAP   GPU_T   MEM_T   GFX_CLK   GFX%   MEM%  SINGLE_ECC  DOUBLE_ECC  PCIE_REPLAY
  0    0  250 W   1400 W   45 °C   35 °C   100 MHz    0 %    0 %           0           0            0
  3    0  255 W   1400 W   47 °C   34 °C   100 MHz    0 %    0 %           0           0            0
  4    0  400 W   1400 W   50 °C   38 °C  2400 MHz   12 %    5 %           0           0            0
  5    0  320 W   1400 W   48 °C   37 °C  2400 MHz    2 %    0 %           0           0            0
  7    0  260 W   1400 W   46 °C   35 °C   100 MHz    0 %    0 %           0           0            0`;

export const metric = `GPU: 4
    POWER:
        SOCKET_POWER: 320 W
    TEMPERATURE:
        EDGE: N/A
        HOTSPOT: 50 °C
        MEM: 38 °C
        HBM_STACKS: [34 °C, 35 °C, 35 °C, 36 °C, 36 °C, 37 °C, 38 °C, 35 °C, N/A, N/A, N/A, N/A]
    PCIE:
        WIDTH: 16
        SPEED: 32 GT/s
        REPLAY_COUNT: 0
        L0_TO_RECOVERY_COUNT: 0
    ECC:
        TOTAL_CORRECTABLE_COUNT: 0
        TOTAL_UNCORRECTABLE_COUNT: 0
        TOTAL_DEFERRED_COUNT: 0
    ENERGY:
        TOTAL_ENERGY_CONSUMPTION: 120050000.000 J
    MEM_USAGE:
        TOTAL_VRAM: 294912 MB
        USED_VRAM: 256000 MB
    THROTTLE:
        PPT_VIOLATION_STATUS: NOT ACTIVE
        SOCKET_THERMAL_VIOLATION_STATUS: NOT ACTIVE
        HBM_THERMAL_VIOLATION_STATUS: NOT ACTIVE`;

/** Two energy readings 10 s apart (amd-smi metric -g 4 -E -p). */
export const energy = [
  { t: '10:00:00.000', ms: Date.parse('2026-01-01T10:00:00.000Z'), joules: 120000000.0, power: 520 },
  { t: '10:00:10.000', ms: Date.parse('2026-01-01T10:00:10.000Z'), joules: 120004200.0, power: 400 },
];
export const energyOut = energy
  .map((e) => `## ${e.t} UTC\n        SOCKET_POWER: ${e.power} W\n        TOTAL_ENERGY_CONSUMPTION: ${e.joules.toFixed(3)} J`)
  .join('\n');
const dJ = energy[1].joules - energy[0].joules;
const dS = (energy[1].ms - energy[0].ms) / 1000;
export const avgWatts = dJ / dS;
export const energyText = `(${energy[1].joules.toFixed(3)} − ${energy[0].joules.toFixed(3)}) J ÷ ${dS.toFixed(3)} s = ${dJ.toFixed(1)} J ÷ ${dS.toFixed(2)} s ≈ ${Math.round(avgWatts)} W`;

export const processOut = `GPU: 4
    PROCESS_INFO:
        NAME: /usr/bin/python3.12
        PID: 41234
        VRAM_MEM: 2.0 MB
    PROCESS_INFO:
        NAME: /usr/bin/python3.12
        PID: 41567
        VRAM_MEM: 240.0 GB
        SDMA_USAGE: 123456789 us
        CU_OCCUPANCY: 0`;

export const xgmi = `XGMI LINK STATUS:
       bdf           GPU0  GPU1  GPU2  GPU3  GPU4  GPU5  GPU6  GPU7
GPU0   0000:11:00.0  SELF  U     U     U     U     U     U     U
GPU3   0000:6b:00.0  U     U     U     SELF  U     U     U     U
GPU4   0000:8b:00.0  U     U     U     U     SELF  U     U     U
GPU7   0000:e5:00.0  U     U     U     U     U     U     U     SELF
Legend:
  U / D / X = Link is Up / Down / Disabled`;

export const badPages = `GPU: 4
    RETIRED: No bad pages found.
    PENDING: No bad pages found.
    UN_RES: No bad pages found.`;

/** sysfs under /sys/class/drm/card5/device (same moment as the metric read). */
export const sysfs = {
  serial: 'SN-EXAMPLE-0005',
  vramTotalBytes: 309237645312,
  vramUsedBytes: 268435456000,
  junctionMilli: 50000,
  memMilli: 38000,
  powerMicroW: 320000000,
};
export const sysfsOut = `serial_number: ${sysfs.serial}
current_link_speed: 32.0 GT/s PCIe
current_link_width: 16
mem_info_vram_total: ${sysfs.vramTotalBytes}
mem_info_vram_used: ${sysfs.vramUsedBytes}
current_compute_partition: SPX
hwmon/hwmon5/temp2_input: ${sysfs.junctionMilli}      (temp2_label: junction)
hwmon/hwmon5/temp3_input: ${sysfs.memMilli}      (temp3_label: mem)
hwmon/hwmon5/power1_input: ${sysfs.powerMicroW}
ras/aca_umc: ue: 0 ce: 0 de: 0
ras/event_state: Fatal Error: count:0, last_seqno:0`;

const MiB = 1024 * 1024;
export const vramTotalMiB = sysfs.vramTotalBytes / MiB; // 294912: amd-smi's "MB" is MiB
export const vramUsedMiB = sysfs.vramUsedBytes / MiB;
export const vramTotalGiB = sysfs.vramTotalBytes / 1024 ** 3;
export const vramUsedPct = (100 * sysfs.vramUsedBytes) / sysfs.vramTotalBytes;
export const sysfsText = {
  vram: `${sysfs.vramTotalBytes.toLocaleString('en-US')} B ÷ 1,048,576 = ${vramTotalMiB.toLocaleString('en-US')} MiB (amd-smi prints "${vramTotalMiB} MB") = ${vramTotalGiB.toFixed(1)} GiB`,
  used: `${sysfs.vramUsedBytes.toLocaleString('en-US')} B ÷ 1,048,576 = ${vramUsedMiB.toLocaleString('en-US')} MiB, ${vramUsedPct.toFixed(1)} % of the card`,
  temp: `${sysfs.junctionMilli} ÷ 1000 = ${sysfs.junctionMilli / 1000} °C junction; ${sysfs.memMilli} ÷ 1000 = ${sysfs.memMilli / 1000} °C memory`,
  power: `${sysfs.powerMicroW.toLocaleString('en-US')} µW ÷ 1,000,000 = ${sysfs.powerMicroW / 1e6} W`,
};
