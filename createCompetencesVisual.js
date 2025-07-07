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
    let SF;


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
            name: central,
            value: hier.size,
            link: Array.from(hier)
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

        //draw();
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
        //hovers
        handleDonutHover();

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
        console.log("Drawing donut...");
        const radius = CHORD;

        const arc = d3.arc()
                    //.cornerRadius(2)
                    .innerRadius(radius*0.67)
                    .outerRadius(radius - 1); //controlla valori

        const pie = d3.pie()
                    .startAngle(-90 * PI/180)
                    .endAngle(-90 * PI/180 + 2*PI)
                    .padAngle(1 / radius)
                    .sort(null)
                    .value(d => d.value);

        //define donut object
        const donut = g.append("g")
                        .attr("id", "donut-chart")
                        .attr("width", width)
                        .attr("height", height)
                        .style("max-width", "100%")
                        .style("height", "auto");
        //draw donut and data join
        donut.selectAll()
             .data(pie(donutData))
             .enter().append("path")
             .attr("class", "donutArcSlices")
             .attr("d", arc)
             .style("fill", COLORS.central)
             .style("border-radius", 8)
             .each(function(d, i){
                //Search pattern for everything between the start and the first capital L
                var firstArcSection = /(^.+?)L/;
                //Grab everything up to the first Line statement
                var newArc = firstArcSection.exec(d3.select(this).attr("d"))[1];
                //Replace all the commas so that IE can handle it
                newArc = newArc.replace(/,/g , " ");

                //If the end angle lies beyond a quarter of a circle (90 degrees or pi/2)
                //rewrite the svg : flip the end and start position
                if (d.endAngle > 90 * PI/180) {
                    //Everything between the capital M and first capital A
                    var startLoc = /M(.*?)A/;
                    //Everything between the capital A and 0 0 1
                    var middleLoc = /A(.*?)0 0 1/;
                    //Everything between the 0 0 1 and the end of the string (denoted by $)
                    var endLoc = /0 0 1 (.*?)$/;
                    //Flip the direction of the arc by switching the start and end point
                    //and using a 0 (instead of 1) sweep flag
                    var newStart = endLoc.exec( newArc )[1];
                    var newEnd = startLoc.exec( newArc )[1];
                    var middleSec = middleLoc.exec( newArc )[1];

                    //Build up the new arc notation, set the sweep-flag to 0
                    newArc = "M" + newStart + "A" + middleSec + "0 0 0 " + newEnd;
                }

                //create a new invisible arc for the text
                donut.append("path")
                     .attr("class", "hiddenDonut")
                     .attr("id", "donutArc"+i)
                     .attr("d", newArc)
                     .style("fill", "none");
             });
       
       //text around path
       donut.selectAll()
            .data(pie(donutData))
            .enter().append("text")
            .attr("class", "donutText")
            .attr("font-size", 12)
            .attr("font-weight", "bold")
            .attr("dy", function(d, i){
                return (d.endAngle > 90 * PI/180 ? 18 : -11);
            })
            .append("textPath")
            .attr("startOffset", "50%")
            .style("text-anchor", "middle")
            .attr("xlink:href", function(d,i){return "#donutArc"+i;})
            //.call(text => text.filter(d => (d.endAngle - d.startAngle) > 0.5).append("tspan")
            .style("visibility", /*d => (d.endAngle - d.startAngle) > 0.5 ? "visible" :*/ "hidden")
            .text(function(d){return d.data.name});
    }

    ////////// Force-Layout 1 ////////////////////

    /////////  Force-Layout 2 ////////////////////

    /////////////////////////////////////////////
    //////////// Set up Hovers /////////////////
    ///////////////////////////////////////////

    function handleDonutHover() {
        const donutSlices = donut.selectAll(".donutArcSlices");
        const donutTexts = donut.selectAll(".donutText textPath");

        donutSlices
            .on("mouseover", function(event, d) {
                console.log("hovered");
                // Dim all other slices
                donutSlices.transition().duration(200)
                    .style("opacity", p => (p.index === d.index ? 1.0 : 0.3));

                // Show the corresponding text
                donutTexts
                    .style("visibility", p => (p.index === d.index ? "visible" : "hidden"));
            })
            .on("mouseout", function() {
                console.log("unhovered");
                // Restore opacity of all slices
                donutSlices.transition().duration(200)
                    .style("opacity", 1.0);

                // Hide all texts
                donutTexts
                    .style("visibility", "hidden");
            });
    }

    chart();
}

