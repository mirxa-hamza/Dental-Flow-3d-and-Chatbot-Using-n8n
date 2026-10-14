/**
 * Which 3D tooth the website shows, and how. The clinic's choice lives in
 * content/clinic.ts (tooth3d); the Model Lab page (/en/model-lab, only while
 * you run the site on your computer) lets you try models and settings first.
 */
export type ToothFinish = 'clinic' | 'own' | 'glass';

export type ToothLook = {
  /** a .glb file in website/public/models, written as '/models/name.glb' */
  file: string;
  /** clinic = our white enamel look, own = the model's own colours, glass = clear glass */
  finish: ToothFinish;
  /** turn the model upright if it was made lying down: degrees around X, Y, Z */
  rotation: [number, number, number];
  /** 1 = the standard size; 1.2 = 20% bigger */
  scale: number;
  /** most free models require a credit, e.g. "Tooth model by NAME, CC BY 4.0" (shown in the footer) */
  credit?: string;
};

export const BUILT_IN_MOLAR: ToothLook = { file: '/models/molar.glb', finish: 'clinic', rotation: [0, 0, 0], scale: 1, credit: '' };
