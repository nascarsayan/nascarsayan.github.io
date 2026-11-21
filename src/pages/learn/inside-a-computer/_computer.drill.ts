/** The computer, level by level: every key in `inside` is a box id of the level above. */
import { defineDrill } from '@/diagrams/drilldown';
import pc from './_pc.diagram';
import cpu from './_cpu.diagram';
import core from './_core.diagram';
import alu from './_alu.diagram';
import adder from './_adder.diagram';
import fulladder from './_fulladder.diagram';
import gate from './_gate.diagram';
import transistor from './_transistor.diagram';
import cache from './_cache.diagram';
import sram from './_sram.diagram';
import dimm from './_dimm.diagram';
import dram from './_dram.diagram';
import bank from './_bank.diagram';
import dramcell from './_dramcell.diagram';
import gpu from './_gpu.diagram';
import sm from './_sm.diagram';
import ssd from './_ssd.diagram';
import nand from './_nand.diagram';
import flashcell from './_flashcell.diagram';
import pch from './_pch.diagram';
import keyboard from './_keyboard.diagram';
import mic from './_mic.diagram';
import psu from './_psu.diagram';

/** Shared levels; also imported by other drill-downs (an HBM die opens into the same bank). */
export const transistorLevel = { title: 'One transistor', spec: transistor };
export const bankLevel = { title: 'One bank', spec: bank, inside: { cells: { title: 'One DRAM bit', spec: dramcell, inside: { t: transistorLevel } } } };
const cacheLevel = { title: 'How a cache finds data', spec: cache, inside: { line: { title: 'Each bit of a line: SRAM', spec: sram, inside: { axl: transistorLevel } } } };

export default defineDrill({
  title: 'A desktop computer',
  spec: pc,
  caption: 'The main parts and how they connect. The CPU talks directly to RAM, the GPU and the SSD; slower devices go through the chipset.',
  inside: {
    cpu: {
      title: 'Inside the CPU',
      spec: cpu,
      inside: {
        core0: {
          title: 'One core',
          spec: core,
          inside: {
            alu: {
              title: 'One integer ALU',
              spec: alu,
              inside: {
                add: {
                  title: 'A 64-bit adder',
                  spec: adder,
                  inside: {
                    fa0: {
                      title: 'One full adder (1 bit)',
                      spec: fulladder,
                      inside: {
                        and1: { title: 'An AND gate from transistors', spec: gate, inside: { n: transistorLevel } },
                      },
                    },
                  },
                },
              },
            },
            l1d: cacheLevel,
            regs: { title: 'Each register bit: SRAM', spec: sram, inside: { axl: transistorLevel } },
          },
        },
        l3: cacheLevel,
      },
    },
    ram: {
      title: 'A DDR5 memory stick',
      spec: dimm,
      inside: {
        chip: {
          title: 'One DRAM chip',
          spec: dram,
          inside: {
            bank: bankLevel,
          },
        },
      },
    },
    gpu: { title: 'A graphics card', spec: gpu, inside: { sm: { title: 'One compute unit (SM)', spec: sm } } },
    ssd: {
      title: 'An NVMe SSD',
      spec: ssd,
      inside: { nand: { title: 'One NAND flash die', spec: nand, inside: { cell: { title: 'One flash cell', spec: flashcell } } } },
    },
    pch: { title: 'The chipset (PCH)', spec: pch },
    kbd: { title: 'A key press, end to end', spec: keyboard },
    mic: { title: 'A microphone, end to end', spec: mic },
    psu: { title: 'The power supply', spec: psu },
  },
});
