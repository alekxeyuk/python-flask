new Vue({
    el: "#app",
    data: {
        tweets: [],
        page: 1,
        resourse_url: '',
        loading: false
    },
    methods: {
        onScroll: function(event){
            var wrapper = event.target,
                list = wrapper.firstElementChild
            var scrollTop = wrapper.scrollTop,
                wrapperHeight = wrapper.offsetHeight,
                listHeight = list.offsetHeight

            var diffHeight = listHeight - wrapperHeight

            if(diffHeight <= scrollTop && !this.loading) {
                this.load()
            }
        },
        load: function(){
            this.loading = true
            this.resourse_url = `https://capi-v2.sankakucomplex.com/posts?lang=english&page=${this.page}&limit=40&tags=order:quality+hide_posts_in_books:never+trap`
            this.$http.get(this.resourse_url).then((responce) => {

                var json = responce.data
                console.log(json)
                this.tweets = this.tweets.concat(json)
                this.page += 1
                this.loading = false

            }, (error) => {
                console.log(error)
                this.loading = false
            })
        }
    },
    created() {
        this.load()
    },
})