exports.dump = function (data1='',data2='',data3='',data4='',data5='',data6='',data7='',data8='',data9='',data10='') {
    let debug = process.env.APP_DEBUG;
    if(debug == 'true') {
        console.log(data1,data2,data3,data4,data5,data6,data7,data8,data9,data10)
    }
};
