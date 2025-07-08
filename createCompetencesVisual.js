////////////////////////////////////////////////////////////////////
/////////////// Visualization designed & developed by //////////////
/////////////////////////// Federico Denni /////////////////////////
///////////////////////// federicodenni.com ////////////////////////
////////////////////////////////////////////////////////////////////

/////////// Credits VisualCinnamon, Observable & the overlord Gemini
/////////// Interactive visualisation of Intangible Cultural Heritage Best Practices
////////// for project TRAMA, by Politecnico di Milano & IcoolHunt S.p.a


/***************** 
 * To do:
 * 
 * - Test central chord element with clicked function
 * - Create Force-layout for rings of project nodes around the central nodes
 * - Create stacked/cleaned connections between project nodes and central nodes
 * - Create second force layout the properties around the projects
 * - Manage UI - interactivity - animations
 * 
******************/


//export visualisation    
const createCompetencesVisual = (container, webcsv) => {    
    /////////////////////////////////////////
    //////// COSTANTS & VARIABLES ///////////
    /////////////////////////////////////////

    const PI = Math.PI;
    const TAU = PI * 2;

    let round = Math.round;
    let cos = Math.cos;
    let sin = Math.sin;
    let sqrt = Math.sqrt;
    let min = Math.min;
    let max = Math.max;
    let abs = Math.abs;

    //Datasets -- capire
    let donutData = [];
    let ringData = [];
    let commons = [];

    const nodes = [];
    const nodes_central = [];
    const links = [];
    const links_central = [];

    let hierarchy = "Title"; //user determined
    let central_nodes = "Fruition Output";
    let properties = "Human Resources";
    let defaultLabel = "Map of Competences and Human Resources for ICH projects";

    //simulations
    let h_simulation;

    //part of visualisation
    let slices;
    let node;
    let link;


    //Hover options
    let HOVER_ACTIVE = false;
    let HOVERED_NODE = null;
    let CLICK_ACTIVE = false;
    let CLICKED_NODE = null;

    //Visual settings
    const CHORD = 150; //radius of central chord with the nodes -- make variable for future
    let RADIUS_HIERARCHY = CHORD *2; //radius of projects nodes that hover around the central (variable with chord)

    const SHARED_FORCE = 0.7; //force of shared properties
    const UNSHARED_FORCE = 1.4; //force for unshared properties -- these will provide an hierarchy

    const MAX_HIERARCHY_WIDTH = 55; //maximum width of the project name before it wraps
    const HIERARCHY_PADDING = 10; //padding between project nodes around the circle

    /////////////////////////////////////////
    /////////////// COLORS //////////////////
    /////////////////////////////////////////

    const COLORS = {
        "background": "#f7f7f7",
        "ui": "#783CE6",
        "central": "#A682E8",
        "hierarchy": "#EA9DF5",
        "commons": "#F2A900",
        "uncommons": "#64D6D3",
        "second-property": "#B2FAF8",
        "third-property": "#F98982",
        "fourth-property": "#475476",
        "links": "#DADADA",
        "text": "#4D4950"
    };

    //////////////////////////////////////////
    /////////////// Set Sizes ////////////////
    //////////////////////////////////////////

    //Sizes
    const DEFAULT_SIZE = 1500;
    let WIDTH = DEFAULT_SIZE;
    let HEIGHT = DEFAULT_SIZE;
    let width = DEFAULT_SIZE;
    let height = DEFAULT_SIZE;
    let SF;

    //////////////////////////////////////////
    /////////////// Create SVG ///////////////
    //////////////////////////////////////////

    const svg = d3.select(container).append("svg") //refactor following schema gemini
        .attr("id", "visualisation")
        .style("display", "block")
        .style("background-color", COLORS.background)
        .style("margin", "0");
    
    const g = svg.append("g")
                 .attr("transform",`translate(${width / 2}, ${height / 2})`); //center g

    ////////////////////////////////////////////
    //////////// Create Functions //////////////
    ////////////////////////////////////////////

    //based on the number of link to the central nodes
    const scale_hierarchy_radius = d3.scaleSqrt()
        .range([8, 30]);

    const scale_properties_radius = d3.scaleSqrt()
        .range([1, 8]);

    //links
    const scale_link_distance = d3.scaleLinear()
        .domain([1,50])
        .range([10,80]);

    const scale_link_width = d3.scalePow()
        .exponent(0.75)
        .range([1,2,60])
    
    ///////////////////////////////////////////////
    /////////////// Create visuals ////////////////
    ///////////////////////////////////////////////

    function chart() {

        //prepare data
        d3.csv(webcsv)
        .then(data => {
            prepareData(data)
            draw();
        })
        .catch(error => {
            console.error('Error loading or parsing CSV:', error); 
        });

        h_simulation = setupHierarchySimulation();

        /**********
         * run force simulation
         * position the donut in the center
         * position the hierarchy in a ring
         * force simulation for commons
         * force simulation for remaining
         * setup Hover
         * setup Click
         ***********/

        chart.resize();
    }

    function draw(){
        g.selectAll("*").remove(); //Clear previous elements

        //draw central donut shape
        donut();

        //draw force simulation elements
        drawForceLayout(nodes, links);

        /************
         * 
         * Draw labels_central
         * Draw property
         * Draw labels
         * 
         *************/

        //setup basic label
        labelCentral(defaultLabel, COLORS.background);

    }//function draw

    chart.resize = () => {

        width = container.offsetWidth;
        height = width;

        //it's the width that determines the size
        WIDTH = width;
        HEIGHT = height;

        svg.attr("width", WIDTH)
           .attr("height", HEIGHT);
        
        g.attr("transform", `translate(${WIDTH / 2}, ${HEIGHT / 2})`);

        if(h_simulation.nodes().lenght > 0) { //restart simulation
            h_simulation.alpha(0.3).restart();
        }

        //set the scale factor
        SF = WIDTH / DEFAULT_SIZE;
        /*****
         * ring logic (resize SF if ring doesn't fit)
         ******/
        if (nodes.length > 0) draw();
    }

    /////////////////////////////////////////////
    /////////////// Prepare data ////////////////
    /////////////////////////////////////////////

    function prepareData(table) {
        //clear arrays for re-reruns
        nodes.length = 0;
        links.lenght = 0;
        donutData.length = 0;
        ringData.length = 0;
        commons.length = 0;

        const parseStringifiedArray = (str) => {
        if(!str || typeof str !== 'string' || !str.startsWith('[') || !str.endsWith(']')) {
            return [];
        };
        try {
            const validJsonString = str.replace(/'/g, '"');
            return JSON.parse(validJsonString);
        } catch (e) {
            console.error("Could not parse string:", str, e);
            return [];
        }
        };// safely parse array of strings

        const cleanedData = table.map(row => ({
            hier: row[hierarchy],
            central: parseStringifiedArray(row[central_nodes]),
            prop: parseStringifiedArray(row[properties])
        }))

        const centralMap = new Map();
        const propCount = new Map();

        cleanedData.forEach(row => {
            row.central.forEach(f => {
                if(!centralMap.has(f)) {
                    centralMap.set(f, new Set());
                }
                centralMap.get(f).add(row.hier);
            });

            row.prop.forEach(p => {
                propCount.set(p, (propCount.get(p) || 0) + 1);
            });
        });

        donutData = Array.from(centralMap, ([central, hier]) => ({
            name: central,
            value: hier.size,
            link: Array.from(hier)
        })); //data for donut shape

        commons = new Set();
        for (const [prop, count] of propCount.entries()) {
            if (count > 1) {
                commons.add(prop);
            }
        }

        //node logic -- push to node for force visualisation
        //first nodes[]
        const addedIds = new Set();

        cleanedData.forEach(d => {
            const h = d.hier;
            if(!addedIds.has(h)) {
              nodes.push({id: h, type: "hierarchy", r:15, color: COLORS.hierarchy});
              addedIds.add(h)   
            }

            d.prop.forEach(p => {
                if(!addedIds.has(p)) {
                    nodes.push({
                        id: p,
                        type: commons.has(p) ? "commons" : "uncommons",
                        r: 8,
                        color: commons.has(p) ? COLORS.commons : COLORS.uncommons
                    });
                    addedIds.add(p);
                }
                links.push({source: h, target: p});
            });
        });

        //nodes_central[]

        console.log("Data processed");
        console.log("Donut data:");
        console.log(donutData);
        console.log("Forcelayout-1 data:");
        console.log(nodes);        
        console.log(links);        
        console.log("Commons:");
        console.log(commons);
    }//prepare data for visualisation
    
    /////////////////// Donut /////////////////////
    /// take number of links_central and uses it as a value
    function donut() {
        console.log("Drawing donut...");
        const radius = CHORD;

        const arc = d3.arc()
                    .cornerRadius(5)
                    .innerRadius(radius*0.8)
                    .outerRadius(radius - 1);

        const pie = d3.pie()
                    .startAngle(-90 * PI/180)
                    .endAngle(-90 * PI/180 + 2*PI)
                    .padAngle(2 / radius)
                    .sort(null) //potrei voler aggiungere un ordine di grandezza
                    .value(d => d.value); //aggiungi una scala (?)

        //define donut object
        const donut = g.append("g")
                        .attr("id", "donut-chart")
                      /*.attr("width", width)
                        .attr("height", height)*/
                        .style("max-width", "100%")
                        .style("height", "auto");

        //draw donut and data join
        slices = donut.selectAll(".donutArcsSlices")
             .data(pie(donutData))
             .enter().append("path")
             .attr("class", "donutArcSlices")
             .attr("d", arc)
             .style("fill", COLORS.central)

        //manage hover of slices -- spostarla in una funzione esterna così da fare stesso effetto ad altri elementi della dataviz
        slices.on("mouseover", handleMouseOver)
              .on("mouseout", handleMouseOut);

        //restore pre-hover
        labelCentral(defaultLabel, COLORS.background);

    }

    ////////////////////////////////////////////
    /////////////// Simulations ////////////////
    ////////////////////////////////////////////
    function setupHierarchySimulation() {
        return d3.forceSimulation()
                .force("link", d3.forceLink().id(d => d.id).distance(30).strength(0.6))
                .force("charge", d3.forceManyBody().strength(d => {
                    if (d.type === "commons") return -50 * SHARED_FORCE;
                    if (d.type === "uncommons") return -100 * UNSHARED_FORCE;
                    return -200;
                }))
                .force("collide", d3.forceCollide().radius(d => d.r + HIERARCHY_PADDING))
                .force("center", d3.forceCenter(0, 0))
                .force("radial", d3.forceRadial(d => d.type === 'hierarchy' ? RADIUS_HIERARCHY : RADIUS_HIERARCHY + 50).strength(0.8));
    }

    ///////// Force-Layout 1 (Hierarchy) ////////

    function drawForceLayout(nodesData, linksData) {
        link = g.append("g")
                .attr("id", "link-group")
                .selectAll("line")
                .data(linksData)
              //.enter().append("line")
                .join("line")
                .attr("stroke", COLORS.links)
                .attr("stroke-width", 0.5);
        
        node = g.append("g")
                .attr("id", "nodes-group")
                .selectAll("g")
                .data(nodesData)
              //.enter().append("g")
                .join("g");
        
        node.append("circle")
            .attr("r", d => d.r)
            .attr("fill", d => d.color);
        
        node.append("title") //create a label not title
            .text(d => d.id)
            .style("font-family", "Inter, sans-serif")
            .style("font-style", "normal")
            .style("colors", COLORS.text)
            .style("font-size", 10);

        node.on("mouseover", handleMouseOver)
            .on("mouseout", handleMouseOut);

        //restore pre-hover
        labelCentral(defaultLabel, COLORS.background);

        //Connect data to simulation
        h_simulation.nodes(nodesData);
        h_simulation.force("link").links(linksData);

        h_simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            
            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        h_simulation.alpha(1).restart();

    }

    //display circle later
    function drawhierarchyRing(){
        console.log("Drawing ring...");
        const radius = RADIUS_PROJECTS;

        const circles = g.append("circle")
                         .attr("id", "hierarchyRing")
                         .attr("width", width)
                         .attr("height", height)
                         .attr("r", radius)
                         .attr("fill", COLORS["third-property"])
        //display circle with a nice gradient
        //display label with type of hierarchy
    }

    /////////////// Force-Layout 2 ///////////////



    //////////////////////////////////////////////
    //////////// Set up Hovers ///////////////////
    //////////////////////////////////////////////

    /*
    * Handles mouseiver events for both slices and nodes
    */
    function handleMouseOver(event, d) {
        //get common identifier from the data object (d)
        const name = d.id || d.data.name;

        //get the color from the nodes data or default
        const color = d.color || COLORS.central;

        //Fade non-hovered slices
        slices.transition()
              .duration(200)
              .style("opacity", (slice_d) => (slice_d.data.name === name ? 1.0 : 0.5));

        //Fade non-hovered nodes
        node.transition()
            .duration(200)
            .style("opacity", (node_d) => (node_d.id === name ? 1.0 : 0.5));

        labelCentral(name, color);
    }

    /****
     * Handles mouseout events
     * 
    */
   function handleMouseOut() {
        //Restore full opacity
        slices.transition()
              .duration(200)
              .style("opacity", 1);

        node.transition()
            .duration(200)
            .style("opacity", 1);

        //Restore default central label
        labelCentral(defaultLabel, COLORS.background);
   }

    //central label function
    function labelCentral(text,color){
        //remove precedent hoverage
        g.select("#centralLabel").remove();

        const padding = 18;
        const innerRadius = CHORD * 0.9 - padding;
        const lineHeight = 1;

        //define central group
        const labelGroup = g.append("g")
                            .attr("id", "centralLabel");

        // 1. Split text into words
        const words = text.split(/\s+/).reverse();

        // 2. Create the text element and initial tspan
        // We will append tspans to this text element as we wrap lines
        const textElement = labelGroup.append("text")
            .attr("class", "central-label")
            .attr("text-anchor", "middle")
            .style("font-family", "Charis SIL, serif")
            .style("font-weight", d => {if (text=== defaultLabel) {return "bold";} else {return "light";}})
            .style("fill", d => {if(text === defaultLabel) {return COLORS.central;} else {return COLORS.background;}}); //maybe make it black?

        let tspan = textElement.append("tspan").attr("x", 0).attr("dy", "0em");
        let line = [];
        let word;
        const maxLineWidth = innerRadius * 1; // Allow text to wrap within ~50% of the circle's diameter

        // 3. Word wrapping logic
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > maxLineWidth && line.length > 1) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = textElement.append("tspan").attr("x", 0).attr("dy", `${lineHeight}em`).text(word);
            }
        }

        // 4. Calculate the final bounding box and the required scaling factor
        const bbox = textElement.node().getBBox();
        const textWidth = bbox.width + 20;
        const textHeight = bbox.height + 20;
        const textRadius= sqrt(textWidth * textWidth + textHeight * textHeight) / 2;

        // The scale factor is the ratio of the circle's radius to the text's effective radius
        const scale = innerRadius / textRadius * 0.8; // 0.8 provides a little extra padding

        // 5. Apply the scale and center the text
        textElement.attr("transform", `scale(${scale})`);
        
        // Adjust vertical position after scaling to perfectly center the block
        // We use getBBox again on the scaled text to get its final height
        const finalBBox = textElement.node().getBBox();
        textElement.attr("y", -finalBBox.y - finalBBox.height / 2);

        // 6. Prepend the circle so it's behind the text
        labelGroup.insert("circle", ".central-label")
            .attr("id", "labelCentral")
            .attr("r", innerRadius)
            .attr("fill", color);
        
        // 7. add label on textPath that represent value of central nodes
    }

    chart();
}

