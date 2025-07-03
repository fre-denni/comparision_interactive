/////////////////////////////////////////////////////////////////////
/////////////// Visualization designed & developed by ///////////////
/////////////////////////// Federico Denni ///////////////////////////
///////////////////////// federicodenni.com ////////////////////////
/////////////////////////////////////////////////////////////////////

/////////// Credits VisualCinnamon, Observable & the overlord Gemini
/////////// Interactive visualisation of Intangible Cultural Heritage Best Practices
////////// for project TRAMA, by Politecnico di Milano & IcoolHunt S.p.a


/***************** 
 * To do:
 * 
 * - Create round chord visual for the central nodes -> test interactivity with select element
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

    //Datasets -- capire
    let donutData = [];
    let ringData = [];
    let commons = [];

    let links_central, links; //serve?

    let hierarchy = "Title"; //user determined
    let central_nodes = "Fruition Output";
    let properties = "Human Resources";

    //Hover options
    let HOVER_ACTIVE = false;
    let HOVERED_NODE = null;
    let CLICK_ACTIVE = false;
    let CLICKED_NODE = null;

    //Visual settings
    const CHORD = 150; //radius of central chord with the nodes -- make variable for future
    let RADIUS_PROJECTS; //radius of projects nodes that hover around the central (variable with chord)

    const SHARED_FORCE = 0.7; //force of shared properties
    const UNSHARED_FORCE = 1; //force for unshared properties -- these will provide an hierarchy

    const MAX_PROJECT_WIDTH = 55; //maximum width of the project name before it wraps
    const PROJECT_PADDING = 20; //padding between project nodes around the circle

    /////////////////////////////////////////
    /////////////// COLORS //////////////////
    /////////////////////////////////////////

    const COLORS = {
        "background": "#f7f7f7",
        "ui": "#783CE6",
        "central": "#A682E8",
        "project": "#EA9DF5",
        "second-property": "#F2A900",
        "third-property": "#64D6D3",
        "fourth-property": "#B2FAF8",
        "fifth-property": "#F98982",
        "sixth-property": "#475476",
        "links": "#DADADA",
        "text": "#4D4950"
    };

    //////////////////////////////////////////
    /////////////// Create SVG ///////////////
    //////////////////////////////////////////

    const svg = d3.select(container).append("svg") //refactor following schema gemini
        .attr("id", "visualisation")
        .style("display", "block")
        .style("margin", "0");
    
    const g = svg.append("g")

    //////////////////////////////////////////
    /////////////// Set Sizes ////////////////
    //////////////////////////////////////////

    //Sizes
    const DEFAULT_SIZE = 1500;
    let WIDTH = DEFAULT_SIZE;
    let HEIGHT = DEFAULT_SIZE;
    let width = DEFAULT_SIZE;
    let height = DEFAULT_SIZE;
    let SF, PIXEL_RATIO;


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
    /////////////// Prepare data //////////////////
    ///////////////////////////////////////////////

    function prepareData(table) {
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
            slices: central,
            count: hier.size,
            hierarchy: Array.from(hier)
        })); //data for donut shape

        ringData = cleanedData.map(d => ({
            source: d.hier,
            target: d.prop
        })); //data for ring shape

        const shared = [];
        for (const [prop, count] of propCount.entries()) {
            if (count > 1) {
                shared.push(prop);
            }
        }
        commons = shared;

        console.log("Data processed");
        console.log(donutData);
        console.log(ringData);
        console.log(commons);
    }//prepare data for visualisation


    ///////////////////////////////////////////////
    /////////////// Create visuals ////////////////
    ///////////////////////////////////////////////

    function chart() {

        //prepare data
        d3.csv(webcsv)
        .then(prepareData)
        .catch(error => {
            console.error('Error loading or parsing CSV:', error);
        });

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

        g.attr("transform", `translate(${WIDTH/2}, ${HEIGHT/2})`)
         .style("background-color", COLORS.background);

        //draw central donut shape
        donut();

        /************
         * 
         * Draw links
         * Draw labels_central
         * Draw hierarchy
         * Draw property
         * Draw labels
         * 
         *************/
    }//function draw

    chart.resize = () => {

        width = container.offsetWidth;
        height = width;

        //it's the width that determines the size
        WIDTH = width;
        HEIGHT = height;

        svg.attr("width", WIDTH)
           .attr("height", HEIGHT);

        //set the scale factor
        SF = WIDTH / DEFAULT_SIZE;
        /*****
         * ring logic (resize SF if ring doesn't fit)
         */

        draw();
    }
    
    /////////////////// Donut /////////////////////
    /// take number of links_central and uses it as a value
    function donut() {
        height = min(width, 500);
        const radius = CHORD /2;

        const arc = d3.arc()
            .innerRadius(radius * 0.67)
            .outerRadius(radius - 1);

        const pie = d3.pie()
            .padAngle(1 / radius)
            .sort(null)
            .value(d => d.value);

        const donut = g.append("g")
                .attr("id", "donut-central")
                .attr("width", width)
                .attr("height", height)
                //.attr("viewBox", [-width /2, -height/2, width, height])
                .attr("style", "max-width: 100%; height:auto;");
        
        donut.selectAll()
             .data(pie(donutData))
             .join("path")
                .attr("fill", COLORS.central)
                .attr("d", arc)
             .append("title")
                .text(d => d.donutData.slices);
        
        donut.append("g")
             .attr("font-family", "Inter, sans-serif")
             .attr("font-size", "12px")
             .attr("text-anchor", "middle")
             .selectAll()
             .data(pie(donutData))
             .join("text")
                .attr("transform", d => `translate(${arc.centroid(d)})`)
                .call(text => text.append("tspan")
                    .attr("y", "-0.4em")
                    .attr("font-weight", "bold")
                    .text(d => d.donutData.slices))
               /* .call(text => text.filter(d => (d.endAngle - d.startAngle) > 0.25).append("tspan")
                    .attr("x", 0)
                    .attr("y", "0.7em")
                    .attr("fill-opacity", 0.7)
                    .text(d => d.donutData.))*/;
        
    }

    /// make a d3.pie() calculations to find angle
    /// make an arc chart to create a donut shape
    /// style the sections

    ////////// Force-Layout 1 ////////////////////

    /////////  Force-Layout 2 ////////////////////

    chart();
}

