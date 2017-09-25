import { bboxCollide as forceCollideBox } from 'd3-bboxCollide';
import { drag } from 'd3-drag';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum
} from 'd3-force';
import { forceBounce } from 'd3-force-bounce';
import { forceSurface } from 'd3-force-surface';
import { scaleOrdinal, schemeCategory20, ScaleOrdinal } from 'd3-scale';
import { interpolateRdGy } from 'd3-scale-chromatic';
import { event, select } from 'd3-selection';
import { zoom } from 'd3-zoom';

const d3 = {
  drag,
  get event() {
    return event;
  },
  forceBounce,
  forceCenter,
  forceCollide,
  forceCollideBox,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceSurface,
  interpolateRdGy,
  select,
  scaleOrdinal,
  schemeCategory20,
  zoom
};

export default d3;

export {
  drag,
  event,
  forceBounce,
  forceCenter,
  forceCollide,
  forceCollideBox,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceSurface,
  interpolateRdGy,
  select,
  scaleOrdinal,
  schemeCategory20,
  zoom
};

export { ScaleOrdinal, Simulation, SimulationNodeDatum, SimulationLinkDatum };
