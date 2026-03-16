import type { Style, Fill, Font, Border } from 'exceljs'

// House style colours
const NAVY = '1F3864'
const MID_BLUE = '2E75B6'
const LIGHT_BLUE = 'DEEAF1'
const GREEN = 'E2EFDA'
const AMBER = 'FFD966'
const GREY = '808080'

const thinBorder: Partial<Border> = { style: 'thin', color: { argb: 'FFD0D0D0' } }
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }

export const titleStyle: Partial<Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 } as Partial<Font>,
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } } as Fill,
  alignment: { vertical: 'middle' },
}

export const headerStyle: Partial<Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 } as Partial<Font>,
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } } as Fill,
  border: borders,
}

export const sectionStyle: Partial<Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 } as Partial<Font>,
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${MID_BLUE}` } } as Fill,
}

export const dataStyleEven: Partial<Style> = {
  font: { size: 10 } as Partial<Font>,
  border: borders,
}

export const dataStyleOdd: Partial<Style> = {
  font: { size: 10 } as Partial<Font>,
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_BLUE}` } } as Fill,
  border: borders,
}

export const totalStyle: Partial<Style> = {
  font: { bold: true, size: 10 } as Partial<Font>,
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GREEN}` } } as Fill,
  border: borders,
}

export const nilStyle: Partial<Style> = {
  font: { italic: true, size: 10 } as Partial<Font>,
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${AMBER}` } } as Fill,
  border: borders,
}

export const projectedStyle: Partial<Style> = {
  font: { italic: true, size: 10 } as Partial<Font>,
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${AMBER}` } } as Fill,
  border: borders,
}

export const greyItalicStyle: Partial<Style> = {
  font: { italic: true, size: 10, color: { argb: `FF${GREY}` } } as Partial<Font>,
  border: borders,
}

export const cancelledStyle: Partial<Style> = {
  font: { size: 10, color: { argb: `FF${GREY}` } } as Partial<Font>,
  border: borders,
}

export const transactionStyle: Partial<Style> = {
  font: { size: 9, color: { argb: 'FF666666' } } as Partial<Font>,
  border: borders,
}
