import { Arrow, Circle, Text } from 'konva';

/* Time Series */

export type Primitive = string | number | boolean | null;

export type TimeSeries<T extends Primitive> = TimePoint<T>[];

export interface TimePoint<T extends Primitive> {
  time: Date;
  state: T;
}

// type TimeSeriesType<R extends TimeSeries<R>> = R;
export type TimeSeriesType<R> = R;
/* -------------------------- */

/* Network */

// export type Full = NodeState | LinkState;
// export type Transient = TransientNodeState | TransientLinkState;

// export interface Network<S extends Full | Transient> {
//   nodes: Node<(NodeState | TransientNodeState) & S>[];
//   links: Link<(LinkState | TransientLinkState) & S>[];
// }

export interface TransientNetwork {
  nodes: Node<TransientNodeState>[];
  links: Link<TransientLinkState>[];
}

export interface Network {
  nodes: Node<NodeState>[];
  links: Link<LinkState>[];
}

export interface D3Node
  extends d3.SimulationNodeDatum,
    Node<TransientNodeState> {}

export interface D3CompleteNode
  extends d3.SimulationNodeDatum,
    CompleteNode<TransientNodeState> {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface D3Link
  extends d3.SimulationLinkDatum<D3Node>,
    Link<TransientLinkState> {}

export interface D3CompleteLink
  extends d3.SimulationLinkDatum<D3CompleteNode>,
    CompleteLink<TransientLinkState> {}

export type D3Network = {
  nodes: Array<D3CompleteNode>;
  links: Array<D3CompleteLink>;
  nodeSet: Map<string, number>;
  linkSet: Map<string, number>;
};

/* -------------------------- */

/* Node */
type NodeRepresentation = Circle;
type NodeLabel = Text;

export interface PartialNode<S extends NodeState | TransientNodeState> {
  state: Partial<S> & {
    size: number;
  };
  representation: NodeRepresentation;
  label: NodeLabel;
}

export interface CompleteNode<S extends NodeState | TransientNodeState>
  extends PartialNode<S> {
  id: string;
}

export interface Node<S extends NodeState | TransientNodeState>
  extends Partial<PartialNode<S>> {
  id: string;
}

export interface TransientNodeState {
  label: string;
  group: string;
  growing: boolean;
}

export type NodeState = {
  [key in keyof TransientNodeState]:
    | TimeSeries<TransientNodeState[key]>
    | TransientNodeState[key]
};

/* -------------------------- */

/* Link */

type LinkRepresentation = Arrow;
type LinkLabel = Text;

export interface PartialLink<S extends LinkState | TransientLinkState> {
  direction: 'bidirectional' | 'unidirectional';
  state: Partial<S> & {
    strength: number;
  };
  representation: LinkRepresentation;
  label: LinkLabel;
}

export interface CompleteLink<S extends LinkState | TransientLinkState>
  extends PartialLink<S> {
  sourceID: string;
  targetID: string;
}

export interface Link<S extends LinkState | TransientLinkState>
  extends Partial<PartialLink<S>> {
  sourceID: string;
  targetID: string;
}

export interface TransientLinkState {
  label: string;
  group: string;
  growing: boolean;
}

export type LinkState = {
  [key in keyof TransientLinkState]:
    | TimeSeries<TransientLinkState[key]>
    | TransientLinkState[key]
};

/* -------------------------- */
