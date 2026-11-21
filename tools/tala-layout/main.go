// tala-layout lays out a graph with TALA and prints positions and edge routes.
//
// Input (stdin, JSON):
//
//	{"direction":"right","seeds":[1,2,3],
//	 "groups":[{"id":"cp","parent":"","labelW":120,"labelH":20}],
//	 "nodes":[{"id":"a","parent":"cp","w":160,"h":56,"shape":"rectangle"}],
//	 "edges":[{"id":"e0","from":"a","to":"b","labelW":60,"labelH":18,"arrow":"end"}]}
//
// Output (stdout, JSON): boxes for every node and group, and for every edge its
// route points plus the label centre when the edge has a label.
//
// Only TALA's public entry point is used. It takes D2's in-memory graph type,
// so the graph is built directly in Go; no D2 source is parsed or rendered.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strings"
	"time"

	"github.com/d2lang/d2/d2graph"
	"github.com/d2lang/d2/d2layouts/d2talalayout"
	"github.com/d2lang/d2/lib/geo"
)

type inGroup struct {
	ID     string  `json:"id"`
	Parent string  `json:"parent"`
	LabelW float64 `json:"labelW"`
	LabelH float64 `json:"labelH"`
	Dir    string  `json:"direction"`
}
type inNode struct {
	ID     string  `json:"id"`
	Parent string  `json:"parent"`
	W      float64 `json:"w"`
	H      float64 `json:"h"`
	Shape  string  `json:"shape"`
}
type inEdge struct {
	ID     string  `json:"id"`
	From   string  `json:"from"`
	To     string  `json:"to"`
	LabelW float64 `json:"labelW"`
	LabelH float64 `json:"labelH"`
	Arrow  string  `json:"arrow"`
}
type input struct {
	Direction string    `json:"direction"`
	Seeds     []int64   `json:"seeds"`
	Groups    []inGroup `json:"groups"`
	Nodes     []inNode  `json:"nodes"`
	Edges     []inEdge  `json:"edges"`
}
type box struct {
	ID string  `json:"id"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
	W  float64 `json:"w"`
	H  float64 `json:"h"`
}
type outEdge struct {
	ID     string       `json:"id"`
	Points [][2]float64 `json:"points"`
	Label  *[2]float64  `json:"label,omitempty"`
}
type output struct {
	Nodes  []box     `json:"nodes"`
	Groups []box     `json:"groups"`
	Edges  []outEdge `json:"edges"`
	Width  float64   `json:"width"`
	Height float64   `json:"height"`
}

const maxItems = 2000

func fail(format string, a ...any) {
	fmt.Fprintf(os.Stderr, "tala-layout: "+format+"\n", a...)
	os.Exit(1)
}

func main() {
	var in input
	dec := json.NewDecoder(os.Stdin)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&in); err != nil {
		fail("bad input: %v", err)
	}
	if len(in.Nodes)+len(in.Groups) > maxItems || len(in.Edges) > maxItems {
		fail("graph too large")
	}

	g := d2graph.NewGraph()
	if in.Direction != "" {
		g.Root.Direction.Value = in.Direction
	}
	objs := map[string]*d2graph.Object{}
	add := func(id, parent string, w, h float64) *d2graph.Object {
		if _, dup := objs[id]; dup {
			fail("duplicate id %q", id)
		}
		p := g.Root
		if parent != "" {
			var ok bool
			if p, ok = objs[parent]; !ok {
				fail("%q: unknown parent %q (list groups before their members)", id, parent)
			}
		}
		// D2 keys children by lower-cased id (TALA validates this).
		key := strings.ToLower(id)
		if _, dup := p.Children[key]; dup {
			fail("%q: id differs only in case from a sibling", id)
		}
		o := &d2graph.Object{
			Graph:      g,
			Parent:     p,
			ID:         id,
			IDVal:      id,
			Box:        geo.NewBox(geo.NewPoint(0, 0), w, h),
			Children:   map[string]*d2graph.Object{},
			Attributes: d2graph.Attributes{},
		}
		p.Children[key] = o
		p.ChildrenArray = append(p.ChildrenArray, o)
		g.Objects = append(g.Objects, o)
		objs[id] = o
		return o
	}
	for _, gr := range in.Groups {
		o := add(gr.ID, gr.Parent, 10, 10)
		if gr.LabelW > 0 {
			o.Label.Value = gr.ID
			o.LabelDimensions.Width = int(math.Ceil(gr.LabelW))
			o.LabelDimensions.Height = int(math.Ceil(gr.LabelH))
			pos := "INSIDE_TOP_LEFT"
			o.LabelPosition = &pos
		}
		if gr.Dir != "" {
			o.Direction.Value = gr.Dir
		}
	}
	for _, n := range in.Nodes {
		if n.W <= 0 || n.H <= 0 {
			fail("%q: size must be positive", n.ID)
		}
		o := add(n.ID, n.Parent, n.W, n.H)
		if n.Shape != "" {
			o.Shape.Value = n.Shape
		}
	}
	edges := map[*d2graph.Edge]string{}
	for _, e := range in.Edges {
		src, ok1 := objs[e.From]
		dst, ok2 := objs[e.To]
		if !ok1 || !ok2 {
			fail("edge %q: unknown endpoint", e.ID)
		}
		de := &d2graph.Edge{Src: src, Dst: dst, Attributes: d2graph.Attributes{}}
		de.DstArrow = e.Arrow != "none"
		de.SrcArrow = e.Arrow == "both"
		if e.LabelW > 0 {
			de.Label.Value = e.ID
			de.LabelDimensions.Width = int(math.Ceil(e.LabelW))
			de.LabelDimensions.Height = int(math.Ceil(e.LabelH))
		}
		g.Edges = append(g.Edges, de)
		edges[de] = e.ID
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	opts := d2talalayout.DefaultOptions()
	if len(in.Seeds) > 0 {
		opts.Seeds = in.Seeds
	}
	if err := d2talalayout.Layout(ctx, g, &opts); err != nil {
		fail("layout: %v", err)
	}

	var out output
	minX, minY, maxX, maxY := math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)
	grow := func(x, y float64) {
		minX, minY, maxX, maxY = math.Min(minX, x), math.Min(minY, y), math.Max(maxX, x), math.Max(maxY, y)
	}
	isGroup := map[string]bool{}
	for _, gr := range in.Groups {
		isGroup[gr.ID] = true
	}
	for id, o := range objs {
		b := box{ID: id, X: o.TopLeft.X, Y: o.TopLeft.Y, W: o.Width, H: o.Height}
		grow(b.X, b.Y)
		grow(b.X+b.W, b.Y+b.H)
		if isGroup[id] {
			out.Groups = append(out.Groups, b)
		} else {
			out.Nodes = append(out.Nodes, b)
		}
	}
	for de, id := range edges {
		oe := outEdge{ID: id}
		for _, p := range de.Route {
			oe.Points = append(oe.Points, [2]float64{p.X, p.Y})
			grow(p.X, p.Y)
		}
		if de.Label.Value != "" && len(de.Route) > 1 {
			pct := 0.5
			if de.LabelPercentage != nil {
				pct = *de.LabelPercentage
			}
			x, y := along(de.Route, pct)
			oe.Label = &[2]float64{x, y}
		}
		out.Edges = append(out.Edges, oe)
	}
	// Shift to the origin.
	for i := range out.Nodes {
		out.Nodes[i].X -= minX
		out.Nodes[i].Y -= minY
	}
	for i := range out.Groups {
		out.Groups[i].X -= minX
		out.Groups[i].Y -= minY
	}
	for i := range out.Edges {
		for j := range out.Edges[i].Points {
			out.Edges[i].Points[j][0] -= minX
			out.Edges[i].Points[j][1] -= minY
		}
		if l := out.Edges[i].Label; l != nil {
			l[0] -= minX
			l[1] -= minY
		}
	}
	out.Width, out.Height = maxX-minX, maxY-minY
	if err := json.NewEncoder(os.Stdout).Encode(out); err != nil {
		fail("write: %v", err)
	}
}

// along returns the point at fraction t of the polyline's length.
func along(route []*geo.Point, t float64) (float64, float64) {
	total := 0.0
	for i := 1; i < len(route); i++ {
		total += math.Hypot(route[i].X-route[i-1].X, route[i].Y-route[i-1].Y)
	}
	target := total * math.Max(0, math.Min(1, t))
	for i := 1; i < len(route); i++ {
		seg := math.Hypot(route[i].X-route[i-1].X, route[i].Y-route[i-1].Y)
		if target <= seg && seg > 0 {
			f := target / seg
			return route[i-1].X + (route[i].X-route[i-1].X)*f, route[i-1].Y + (route[i].Y-route[i-1].Y)*f
		}
		target -= seg
	}
	last := route[len(route)-1]
	return last.X, last.Y
}
