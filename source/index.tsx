import { Arrow, Circle, Layer, Text } from 'konva';
import * as React from 'react';
import * as reactKonva from 'react-konva';
import { ProgressBar } from 'react-player-controls';
import ResizeAware from 'react-resize-aware';

import d3 from './d3';

import {
  CompleteLink,
  CompleteNode,
  D3CompleteLink,
  D3CompleteNode,
  D3Link,
  D3Network,
  D3Node,
  Link,
  LinkState,
  Network,
  Node,
  NodeState,
  Primitive,
  TimeSeries,
  TransientLinkState,
  TransientNodeState
} from './definitions';

export * from './definitions';

export interface Props {
  width?: number;
  height?: number;
  network: Network;
}

export interface State {
  dimension: {
    height: number;
    width: number;
  };
  margin: number;
  currentTime: Date;
}

// to be removed
export type NodeLink = CompleteNode<NodeState> | CompleteLink<LinkState>;
export type TransientNodeLink =
  | Node<TransientNodeState>
  | Link<TransientLinkState>;
// ------------------

export class TemporalNetwork extends React.Component<Props, State> {
  public refs: {
    canvas: HTMLCanvasElement;
    container: HTMLDivElement;
    stage: reactKonva.Stage;
    nodeLayer: reactKonva.Layer & Layer;
    linkLayer: reactKonva.Layer & Layer;
    labelLayer: reactKonva.Layer & Layer;
  };

  private transform: (input: [number, number]) => [number, number];
  private groupColor: d3.ScaleOrdinal<string, any>;
  private strengthColor: (strength: number) => string;
  private simulation: d3.Simulation<D3Node, D3Link>;

  private network: D3Network;
  private ticker: number;
  private beginning: number;
  private totalTime: number;

  constructor() {
    super();

    // set the initial sate;
    this.state = {
      currentTime: new Date(),
      dimension: { height: -1, width: -1 },
      margin: 50
    };

    // set up D3 helper functions
    this.transform = ([x, y]: [number, number]): [number, number] => [x, y];
    this.groupColor = d3.scaleOrdinal(d3.schemeCategory20);
    this.strengthColor = d3.interpolateRdGy;

    // set up the ticker
    this.setupTicker();
  }

  public componentWillMount(): void {
    // obtain a list of timestamps
    const timestamps: number[] = [];
    for (const pick of ['nodes', 'links']) {
      for (const nodelink of this.props.network[pick] as
        | Node<NodeState>[]
        | Link<LinkState>[]) {
        if (nodelink.state) {
          for (const key of Object.keys(nodelink.state)) {
            const records: TimeSeries<any> = nodelink.state[key];
            if (Array.isArray(records)) {
              for (const record of records) {
                timestamps.push(record.time.getTime());
              }
            }
          }
        }
      }
    }

    this.beginning = Math.max(
      Math.min(...timestamps),
      new Date('1990-01-01').getTime()
    );
    this.totalTime = Math.max(...timestamps) - this.beginning;

    // set the current time to the beginning
    this.setState({
      currentTime: new Date(this.beginning)
    });
  }

  public componentDidMount(): void {
    // initialise the D3 Network
    this.network = {
      nodes: [],
      links: [],
      nodeSet: new Map(),
      linkSet: new Map()
    };
    // this.updateD3Network();

    this.simulation = d3
      .forceSimulation<D3Node, D3Link>()
      .alphaTarget(0)
      .force('bounce', d3.forceBounce())
      .force('center', d3.forceCenter())
      .force('charge', d3.forceManyBody())
      .force('collide', d3.forceCollideBox())
      .force('surface', d3.forceSurface())
      .force('link', d3.forceLink())
      .on('tick', this.draw.bind(this));

    // this.canvasContext = this.refs.canvas.getContext('2d') as any;

    const canvas = this.refs.stage.getStage().container();

    d3
      .select(canvas)
      .call(
        d3
          .drag<HTMLCanvasElement, D3Node>()
          .container(canvas)
          .subject(this.dragsubject.bind(this))
          .on('start', this.dragstarted.bind(this))
          .on('drag', this.dragged.bind(this))
          .on('end', this.dragended.bind(this))
      )
      .call(
        d3.zoom().scaleExtent([1 / 2, 5]).on('zoom', this.zoomed.bind(this))
      )
      .on('mousemove', () => {
        const node = this.getClosestNode(2.5);
        if (node) {
          //   .on("mouseover", function(d) {
          //     div.transition()
          //         .duration(200)
          //         .style("opacity", .9);
          //     div	.html(formatTime(d.date) + "<br/>"  + d.close)
          //         .style("left", (d3.event.pageX) + "px")
          //         .style("top", (d3.event.pageY - 28) + "px");
          //     })
          // .on("mouseout", function(d) {
          //     div.transition()
          //         .duration(500)
          //         .style("opacity", 0);
        }
      });
  }

  public componentDidUpdate(): void {
    // update the dimension of the stage
    this.refs.stage.getStage().width(this.state.dimension.width);
    this.refs.stage.getStage().height(this.state.dimension.height);

    // stop the simulation before updating
    this.simulation.stop();

    // update the network
    this.updateD3Network();

    // let D3 picks up the changes in nodes and links
    this.simulation.nodes(this.network.nodes);
    this.simulation.force(
      'bounce',
      d3
        .forceBounce()
        .elasticity(1)
        .radius((node: D3CompleteNode) => 1.5 * node.representation.radius())
    );
    this.simulation.force(
      'center',
      d3
        .forceCenter<D3CompleteNode>()
        .x(this.state.dimension.width / 2)
        .y(this.state.dimension.height / 2)
    );

    this.simulation.force(
      'charge',
      d3
        .forceManyBody<D3CompleteNode>()
        .strength((node: D3CompleteNode) => -5 * node.representation.radius())
        .distanceMin(1)
        .distanceMax(2000)
    );

    this.simulation.force(
      'collide',
      d3
        .forceCollideBox()
        .bbox((node: D3CompleteNode): [[number, number], [number, number]] => [
          [0, 0],
          [10 + node.label.width(), 10 + node.label.height()]
        ])
        .strength(0.7)
        .iterations(1)
    );

    this.simulation.force(
      'surface',
      d3
        .forceSurface()
        .surfaces([
          {
            from: { x: this.state.margin, y: this.state.margin },
            to: {
              x: this.state.margin,
              y: this.state.dimension.height - this.state.margin
            }
          },
          {
            from: {
              x: this.state.margin,
              y: this.state.dimension.height - this.state.margin
            },
            to: {
              x: this.state.dimension.width - this.state.margin,
              y: this.state.dimension.height - this.state.margin
            }
          },
          {
            from: {
              x: this.state.dimension.width - this.state.margin,
              y: this.state.dimension.height - this.state.margin
            },
            to: {
              x: this.state.dimension.width - this.state.margin,
              y: this.state.margin
            }
          },
          {
            from: {
              x: this.state.dimension.width - this.state.margin,
              y: this.state.margin
            },
            to: { x: this.state.margin, y: this.state.margin }
          }
        ])
        .elasticity(0)
        .oneWay(true)
        .radius((node: D3CompleteNode) => 1.5 * node.representation.radius())
    );

    this.simulation.force(
      'link',
      d3
        .forceLink<D3Node, D3Link>()
        .links([])
        .id((node: D3CompleteNode): string => node.id)
        .distance(
          (link: D3CompleteLink): number =>
            link.state.strength
              ? (link.source as D3CompleteNode).representation.radius() +
                (link.target as D3CompleteNode).representation.radius() +
                20 +
                70 * Math.exp(-0.1 * link.state.strength)
              : -10
        )
        .strength(
          (link: D3CompleteLink): number =>
            link.state.strength
              ? 0.3 +
                0.5 *
                  (2 / (1 + Math.exp(-Math.abs(link.state.strength) / 10)) - 1)
              : 10
        )
        .links(this.network.links)
    );

    // restart the simulation
    this.simulation.alpha(0.1).restart();
  }

  public render(): JSX.Element {
    const style = {
      ...this.props,
      height: this.props.height ? `${this.props.height}px` : '100%',
      width: this.props.width ? `${this.props.width}px` : '100%'
    };

    // <canvas
    //   height={this.props.height}
    //   width={this.props.width}
    //   ref="canvas"
    // />
    return (
      <ResizeAware
        style={style}
        onlyEvent
        onResize={this.handleResize.bind(this)}
      >
        <reactKonva.Stage ref="stage">
          <reactKonva.Layer ref="linkLayer" />
          <reactKonva.Layer ref="nodeLayer" />
          <reactKonva.Layer ref="labelLayer">
            <reactKonva.Text
              x={0}
              y={0}
              fontSize={30}
              text={this.state.currentTime.toString()}
            />
          </reactKonva.Layer>
        </reactKonva.Stage>
        <ProgressBar
          totalTime={this.totalTime}
          currentTime={this.state.currentTime.getTime() - this.beginning}
          isSeekable={true}
          onSeek={(seekTime: number): void => {
            this.setState({ currentTime: new Date(this.beginning + seekTime) });
          }}
          onSeekStart={(seekTime: number): void => {
            this.clearTicker();
          }}
          onSeekEnd={(seekTime: number): void => {
            this.setupTicker();
          }}
          onIntent={(seekTime: number): void => {
            /* f.i. update intended time marker */
          }}
        />
      </ResizeAware>
    );
  }

  public componentWillUnmount(): void {
    // remove the ticker before unmounting
    this.clearTicker();
  }

  private setupTicker(): void {
    // remove previous ticker if exists
    this.clearTicker();

    this.ticker = setInterval(() => {
      const newTime = Math.min(
        this.state.currentTime.getTime() + 30 * 24 * 3600000,
        this.beginning + this.totalTime
      );

      this.setState({
        currentTime: new Date(newTime)
      });

      if (newTime === this.beginning + this.totalTime) {
        // stop the ticker when it reach the end
        clearInterval(this.ticker);
      }
    }, 200);
  }

  private clearTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = 0;
    }
  }

  private handleResize(dimension: { width: number; height: number }): void {
    this.setState({ dimension });
  }

  private size(size: number, base: number): number {
    return 5 * (1 + size - base);
  }

  private strength(strength: number): number {
    return 0.2 + (strength - 1);
  }

  private draw(): void {
    // this.canvasContext.clearRect(0, 0, this.props.width, this.props.height);
    // this.D3Network.links.forEach(this.drawLink.bind(this));
    // this.D3Network.nodes.forEach(this.drawNode.bind(this));

    // update konva
    for (const node of this.network.nodes as D3CompleteNode[]) {
      const nodeRadius = node.representation.radius();
      node.representation.x(node.x);
      node.representation.y(node.y);

      if (node.state.label) {
        node.label.x(node.x + nodeRadius + 3);
        node.label.y(node.y - nodeRadius - 8);
      }
    }
    for (const link of this.network.links as D3CompleteLink[]) {
      const source = link.source as D3CompleteNode;
      const target = link.target as D3CompleteNode;
      link.representation.points([source.x, source.y, target.x, target.y]);

      // if (link.state.label) {
      link.label.x(
        (link.representation.points()[0] + link.representation.points()[2]) /
          2 +
          3
      );
      link.label.y(
        (link.representation.points()[1] + link.representation.points()[3]) /
          2 -
          8
      );
      // }
    }
    this.refs.linkLayer.draw();
    this.refs.nodeLayer.draw();
    this.refs.labelLayer.draw();
  }

  private getClosestNode(radius?: number): D3Node {
    return this.simulation.find(d3.event.x, d3.event.y, radius) as D3Node;
  }

  private dragsubject(): D3Node {
    return this.simulation.find(d3.event.x, d3.event.y) as D3Node;
  }

  // private tooltip(): void {
  //   if (!d3.event.active) {
  //     this.simulation.alphaTarget(0.3).restart();
  //   }
  // }

  private dragstarted(): void {
    if (!d3.event.active) {
      this.simulation.alphaTarget(0.3).restart();
    }
    d3.event.subject.fx = d3.event.subject.x;
    d3.event.subject.fy = d3.event.subject.y;
  }

  private dragged(): void {
    d3.event.subject.fx = d3.event.x;
    d3.event.subject.fy = d3.event.y;
  }

  private dragended(): void {
    if (!d3.event.active) this.simulation.alphaTarget(0);
    d3.event.subject.fx = null;
    d3.event.subject.fy = null;
  }

  private zoomed(): void {
    if (d3.event.transform) {
      this.transform = d3.event.transform.apply.bind(d3.event.transform);
    }

    this.refs.stage.getStage().x(d3.event.transform.x);
    this.refs.stage.getStage().y(d3.event.transform.y);

    this.refs.stage
      .getStage()
      .scale({ x: d3.event.transform.k, y: d3.event.transform.k });

    this.draw();
  }

  private getStateAtTime<T extends Primitive>(
    timeseries: TimeSeries<T>,
    time?: Date
  ): T | null {
    const targetTime = time ? time : this.state.currentTime;
    if (Array.isArray(timeseries)) {
      const sortedTimeseries = [...timeseries].sort(
        (earierTime, laterTime) =>
          laterTime.time.getTime() - earierTime.time.getTime()
      );
      for (const timepoint of sortedTimeseries) {
        // assuming timeseries is sorted from latest to earliest
        if (timepoint.time < targetTime) {
          return timepoint.state;
        }
      }

      // null state for the time before an initial state is recorded
      return null;
    } else {
      // return the constant state
      return timeseries;
    }
  }

  private extractTransientNodes(
    nodes: Node<NodeState>[]
  ): Node<TransientNodeState>[] {
    const transientNodes: Node<TransientNodeState>[] = [];

    for (const node of nodes) {
      const state = { size: 0 };
      Object.entries(node.state).forEach(([name, timeseries]) => {
        state[name] = timeseries ? this.getStateAtTime(timeseries) : null;
      });

      const transientNode: Node<TransientNodeState> = {
        ...node,
        state
      };

      if (transientNode.state && transientNode.state.size) {
        // only include nodes and link with size or strength > 0
        transientNodes.push(transientNode);
      }
    }

    // return the transient
    return transientNodes;
  }

  private extractTransientLinks(
    links: Link<LinkState>[]
  ): Link<TransientLinkState>[] {
    const transientLinks: Link<TransientLinkState>[] = [];

    for (const nl of links) {
      const state = { strength: 0 };
      Object.entries(nl.state).forEach(([name, timeseries]) => {
        state[name] = timeseries ? this.getStateAtTime(timeseries) : null;
      });

      const transientLink: Link<TransientLinkState> = {
        ...nl,
        state
      };

      if (transientLink.state && transientLink.state.strength) {
        // only include nodes and link with size or strength > 0
        transientLinks.push(transientLink);
      }
    }

    // return the transient
    return transientLinks;
  }

  // private isTransientNode(
  //   mixedNodeLink: Node<TransientNodeState> | Link<TransientLinkState>
  // ): mixedNodeLink is Node<TransientNodeState> {
  //   const state = (mixedNodeLink as Node<TransientNodeState>).state;
  //
  //   return (
  //     state !== undefined &&
  //     state.size !== undefined &&
  //     typeof state.size === 'number'
  //   );
  // }
  //
  // private isTransientLink(
  //   mixedNodeLink: Node<TransientNodeState> | Link<TransientLinkState>
  // ): mixedNodeLink is Link<TransientLinkState> {
  //   const state = (mixedNodeLink as Link<TransientLinkState>).state;
  //
  //   return (
  //     state !== undefined &&
  //     state.strength !== undefined &&
  //     typeof state.strength === 'number'
  //   );
  // }

  private updateD3Network(): void {
    if (this.simulation) {
      this.simulation.stop();
    }

    const nodes: Node<TransientNodeState>[] = this.extractTransientNodes(
      this.props.network.nodes
    );
    const links: Link<TransientLinkState>[] = this.extractTransientLinks(
      this.props.network.links
    );

    // calculate the new node and link sets
    const newNodeSet = new Map<string, number>(
      nodes.map((node, index): [string, number] => [node.id, index])
    );
    const newLinkSet = new Map<string, number>(
      links
        .filter(
          link => newNodeSet.has(link.sourceID) && newNodeSet.has(link.targetID)
        )
        .map((link, index): [string, number] => [
          `${link.sourceID}-${link.targetID}`,
          index
        ])
    );

    // a cache for initial position
    const lastNodeCoordinate = this.network.nodes.length
      ? {
          x:
            this.network.nodes[this.network.nodes.length - 1].x +
            20 * (Math.random() - 0.5),
          y:
            this.network.nodes[this.network.nodes.length - 1].y +
            20 * (Math.random() - 0.5)
        }
      : null;

    // obtain the smallest node
    const minimumSize = Math.min(
      ...nodes.map(node => (node.state ? node.state.size : 0))
    );

    // obtain all new nodes by comparing the existing node set
    for (const node of nodes) {
      const color =
        node.state && node.state.group
          ? this.groupColor(node.state.group.toString())
          : 'grey';

      const radius =
        node.state && node.state.size
          ? this.size(node.state.size, minimumSize)
          : 0;

      const text = node.state && node.state.label ? node.state.label : '';

      if (this.network.nodeSet.has(node.id)) {
        // update the state of the existing node
        if (node.state) {
          this.network.nodes[
            this.network.nodeSet.get(node.id) as number
          ].state =
            node.state;
        }

        // update the color and size of the node representation
        this.network.nodes[
          this.network.nodeSet.get(node.id) as number
        ].representation.fill(color);
        this.network.nodes[
          this.network.nodeSet.get(node.id) as number
        ].representation.radius(radius);

        // update the color and text of the label
        this.network.nodes[
          this.network.nodeSet.get(node.id) as number
        ].label.fill(color);
        this.network.nodes[
          this.network.nodeSet.get(node.id) as number
        ].label.text(text);
      } else {
        // create a representation of the node
        const representation = new Circle({
          fill: color,
          radius,
          draggable: true
        });
        this.refs.nodeLayer.add(representation);

        // create a label for the node
        const label = new Text({
          fill: color,
          text,
          fontSize: 11
        });

        this.refs.labelLayer.add(label);

        // add the new node
        this.network.nodes.push({
          state: { size: 0 },
          ...node,
          ...lastNodeCoordinate
            ? lastNodeCoordinate
            : {
                x:
                  this.state.margin +
                  Math.random() *
                    (this.state.dimension.width - 2 * this.state.margin),
                y:
                  this.state.margin +
                  Math.random() *
                    (this.state.dimension.height - 2 * this.state.margin)
              }, // add the node near the last node or randomly if no node has been added
          ...{ vx: 0, vy: 0 },
          representation,
          label
        });
      }
    }

    // add new links to the private network
    for (const link of links) {
      const id = `${link.sourceID}-${link.targetID}`;
      const color = this.strengthColor(
        link.state
          ? -(
              1 / 2 +
              (link.state.strength > 0 ? 1 : -1) /
                (1 + Math.exp(-Math.abs(link.state.strength)))
            )
          : -10
      );
      const strokeWidth =
        link.state && link.state.strength
          ? this.strength(link.state.strength)
          : 0;

      const text =
        link.state && link.state.label
          ? link.state.label
          : strokeWidth.toString();

      if (this.network.linkSet.has(id)) {
        // update the state of the existing link
        if (link.state) {
          this.network.links[this.network.linkSet.get(id) as number].state =
            link.state;
        }

        // update the color and size of the node representation
        this.network.links[
          this.network.linkSet.get(id) as number
        ].representation.stroke(color);
        this.network.links[
          this.network.linkSet.get(id) as number
        ].representation.strokeWidth(strokeWidth);

        // update the color and text of the label
        this.network.links[this.network.linkSet.get(id) as number].label.fill(
          color
        );
        this.network.links[this.network.linkSet.get(id) as number].label.text(
          text
        );
      } else if (
        newNodeSet.has(link.sourceID) &&
        newNodeSet.has(link.targetID)
      ) {
        // create a representation of the node
        const representation = new Arrow({
          pointerLength: 10,
          pointerWidth: 10,
          stroke: color,
          strokeWidth,
          points: []
        });
        this.refs.linkLayer.add(representation);

        // create a label for the link
        const label = new Text({
          fill: color,
          text,
          fontSize: 11
        });
        this.refs.labelLayer.add(label);

        // add the new link
        this.network.links.push({
          direction: 'unidirectional',
          state: {
            strength: 0
          },
          ...link,
          source: link.sourceID,
          target: link.targetID,
          representation,
          label
        });
      }
    }

    // remove nodes and links which are no longer in the network
    this.network.nodes = this.network.nodes.filter(node => {
      const remain = newNodeSet.has(node.id);
      if (!remain) {
        // remove the node representation from the konva layer
        node.representation.destroy();
        node.label.destroy();
      }

      return remain;
    });
    this.network.links = this.network.links.filter(link => {
      const remain = newLinkSet.has(`${link.sourceID}-${link.targetID}`);

      if (!remain) {
        // remove the link representation from the konva layer
        link.representation.destroy();
        link.label.destroy();
      }

      return remain;
    });

    // replace the old id sets with the new ones
    this.network.nodeSet = newNodeSet;
    this.network.linkSet = newLinkSet;
  }
}

export default TemporalNetwork;
